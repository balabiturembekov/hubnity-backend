import { Injectable, NotFoundException, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { TimeEntriesService } from '../time-entries/time-entries.service';
import { PinoLogger } from 'nestjs-pino';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Injectable()
export class IdleDetectionService implements OnModuleInit {
  private readonly logger = new Logger(IdleDetectionService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private timeEntriesService: TimeEntriesService,
    private pinoLogger: PinoLogger,
  ) {
    this.pinoLogger.setContext(IdleDetectionService.name);
  }

  onModuleInit() {
    this.logger.log('Idle Detection Service initialized');
  }

  /**
   * Обработка heartbeat от клиента
   * Обновляет время последней активности пользователя
   */
  async handleHeartbeat(userId: string, companyId: string, dto: HeartbeatDto) {
    try {
      // Проверяем существование компании и включена ли детекция простоя
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          idleDetectionEnabled: true,
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Проверяем существование пользователя и его статус
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
          status: 'ACTIVE', // Только активные пользователи могут отправлять heartbeat
        },
      });

      if (!user) {
        throw new NotFoundException('User not found or inactive');
      }

      const now = new Date();

      // Обновляем или создаем запись активности
      // Если пользователь отправил heartbeat, он больше не в простое
      try {
        await this.prisma.userActivity.upsert({
          where: { userId },
          create: {
            userId,
            lastHeartbeat: now,
            isIdle: false,
          },
          update: {
            lastHeartbeat: now,
            // Если явно указано isActive: false, ставим isIdle: true
            // Иначе (isActive: true или не указано) - isIdle: false
            isIdle: dto.isActive === false,
          },
        });
      } catch (upsertError: any) {
        // Обрабатываем специфичные ошибки upsert (например, constraint violation)
        if (upsertError.code === 'P2002') {
          // Unique constraint violation - попробуем еще раз с update
          this.pinoLogger.warn(
            { userId, companyId, error: upsertError.message },
            'Unique constraint violation on upsert, retrying with update',
          );
          try {
            await this.prisma.userActivity.update({
              where: { userId },
              data: {
                lastHeartbeat: now,
                isIdle: dto.isActive === false,
              },
            });
          } catch (updateError: any) {
            // Если update также не удается (например, запись была удалена), создаем новую
            if (updateError.code === 'P2025') {
              this.pinoLogger.warn(
                { userId, companyId, error: updateError.message },
                'UserActivity not found during update, creating new record',
              );
              await this.prisma.userActivity.create({
                data: {
                  userId,
                  lastHeartbeat: now,
                  isIdle: dto.isActive === false,
                },
              });
            } else {
              throw updateError;
            }
          }
        } else {
          throw upsertError;
        }
      }

      this.pinoLogger.debug({ userId, companyId, isActive: dto.isActive }, 'Heartbeat received');

      return { success: true, timestamp: now };
    } catch (error) {
      this.pinoLogger.error({ error: error.message, userId, companyId }, 'Failed to handle heartbeat');
      throw error;
    }
  }

  /**
   * Проверка простоя пользователя
   * Возвращает true если пользователь в простое
   */
  async checkUserIdle(userId: string, companyId: string): Promise<boolean> {
    // Проверяем принадлежность пользователя к компании
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      // Пользователь не найден в компании - не проверяем простоя
      return false;
    }

    const userActivity = await this.prisma.userActivity.findUnique({
      where: { userId },
    });

    if (!userActivity) {
      // Если нет записи активности, считаем что пользователь в простое
      return true;
    }

    // Получаем настройки компании
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        idleDetectionEnabled: true,
        idleThreshold: true,
      },
    });

    if (!company || !company.idleDetectionEnabled) {
      return false;
    }

    const now = new Date();
    const lastHeartbeat = new Date(userActivity.lastHeartbeat);
    const idleThresholdSeconds = company.idleThreshold ?? 300; // default 5 minutes (используем ?? вместо || для корректной обработки 0)
    const secondsSinceLastHeartbeat = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000);

    // Обрабатываем случай, когда lastHeartbeat в будущем (неправильные часы)
    const safeSecondsSinceLastHeartbeat = secondsSinceLastHeartbeat < 0 ? 0 : secondsSinceLastHeartbeat;

    return safeSecondsSinceLastHeartbeat > idleThresholdSeconds;
  }

  /**
   * Автоматическая пауза time entry при простое
   */
  async pauseTimeEntryIfIdle(userId: string, companyId: string): Promise<boolean> {
    try {
      // Используем транзакцию для предотвращения race conditions
      const result = await this.prisma.$transaction(async (tx) => {
        // Проверяем простоя в транзакции
        const userActivity = await tx.userActivity.findUnique({
          where: { userId },
        });

        if (!userActivity) {
          // Если нет записи активности, не ставим на паузу (новый пользователь)
          return null;
        }

        // Получаем настройки компании
        const company = await tx.company.findUnique({
          where: { id: companyId },
          select: {
            idleDetectionEnabled: true,
            idleThreshold: true,
          },
        });

        if (!company || !company.idleDetectionEnabled) {
          return null;
        }

        const now = new Date();
        const lastHeartbeat = new Date(userActivity.lastHeartbeat);
        const idleThresholdSeconds = company.idleThreshold ?? 300; // используем ?? вместо || для корректной обработки 0
        const secondsSinceLastHeartbeat = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000);
        
        // Обрабатываем случай, когда lastHeartbeat в будущем (неправильные часы)
        const safeSecondsSinceLastHeartbeat = secondsSinceLastHeartbeat < 0 ? 0 : secondsSinceLastHeartbeat;

        // Проверяем простоя
        if (safeSecondsSinceLastHeartbeat <= idleThresholdSeconds) {
          return null;
        }

        // Проверяем статус пользователя в транзакции
        const user = await tx.user.findFirst({
          where: {
            id: userId,
            companyId,
            status: 'ACTIVE', // Только активные пользователи
          },
          select: {
            id: true,
            role: true,
          },
        });

        if (!user) {
          // Пользователь не найден или неактивен - не ставим на паузу
          return null;
        }

        // Находим активный time entry в транзакции
        const activeEntry = await tx.timeEntry.findFirst({
          where: {
            userId,
            status: 'RUNNING',
            user: {
              companyId,
            },
          },
          include: {
            user: {
              select: {
                role: true,
              },
            },
          },
        });

        if (!activeEntry) {
          return null;
        }

        // Проверяем еще раз простоя перед паузой (double-check)
        // Перечитываем userActivity в транзакции, чтобы получить актуальное значение lastHeartbeat
        // Это защищает от race condition, когда heartbeat обновляется во время проверки
        const currentUserActivity = await tx.userActivity.findUnique({
          where: { userId },
        });

        if (!currentUserActivity) {
          return null;
        }

        const lastHeartbeatCheck = new Date(currentUserActivity.lastHeartbeat);
        const secondsSinceLastHeartbeatCheck = Math.floor((now.getTime() - lastHeartbeatCheck.getTime()) / 1000);
        const safeSecondsSinceLastHeartbeatCheck = secondsSinceLastHeartbeatCheck < 0 ? 0 : secondsSinceLastHeartbeatCheck;
        if (safeSecondsSinceLastHeartbeatCheck <= idleThresholdSeconds) {
          return null;
        }

        // НЕ обновляем isIdle здесь - обновим только после успешной паузы
        // Это предотвращает ситуацию, когда isIdle=true, но entry не была поставлена на паузу
        return { entry: activeEntry, companyId };
      });

      if (!result) {
        return false;
      }

      // Проверяем, что result содержит entry
      if (!result.entry || !result.entry.id) {
        this.pinoLogger.warn(
          { userId, companyId },
          'Invalid result from transaction - missing entry',
        );
        return false;
      }

      // Ставим на паузу вне транзакции (pause сам использует транзакцию)
      try {
        await this.timeEntriesService.pause(
          result.entry.id,
          result.companyId,
          userId,
          result.entry.user.role,
        );

        // Обновляем isIdle только после успешной паузы
        try {
          await this.prisma.userActivity.update({
            where: { userId },
            data: { isIdle: true },
          });
        } catch (updateError: any) {
          // Если не удалось обновить isIdle, логируем, но не критично
          this.pinoLogger.warn(
            { userId, companyId, error: updateError.message },
            'Failed to update isIdle after successful pause',
          );
        }

        // Отправляем уведомление через WebSocket (обрабатываем ошибки)
        try {
          this.eventsGateway.broadcastIdleDetection({
            userId,
            timeEntryId: result.entry.id,
            action: 'paused',
            reason: 'idle',
          }, result.companyId);
        } catch (broadcastError: any) {
          // Если не удалось отправить WebSocket событие, логируем, но не критично
          this.pinoLogger.warn(
            { userId, timeEntryId: result.entry.id, error: broadcastError.message },
            'Failed to broadcast idle detection event',
          );
        }

        this.pinoLogger.info(
          { userId, timeEntryId: result.entry.id, companyId: result.companyId },
          'Time entry automatically paused due to idle detection',
        );

        return true;
      } catch (pauseError: any) {
        // Если pause выбрасывает исключение (например, entry уже не RUNNING),
        // это нормально - просто логируем и возвращаем false
        if (pauseError.message?.includes('Only running entries can be paused') || 
            pauseError.message?.includes('not found') ||
            pauseError.message?.includes('You can only pause')) {
          this.pinoLogger.debug(
            { userId, timeEntryId: result.entry.id, error: pauseError.message },
            'Time entry was already paused, not found, or permission denied, skipping',
          );
        } else {
          this.pinoLogger.warn(
            { userId, timeEntryId: result.entry.id, error: pauseError.message },
            'Failed to pause time entry after idle detection',
          );
        }
        return false;
      }
    } catch (error: any) {
      this.pinoLogger.error(
        { error: error.message, userId, companyId },
        'Failed to pause time entry due to idle',
      );
      return false;
    }
  }

  /**
   * Cron job: проверка простоя каждую минуту
   * Проверяет всех пользователей с активными time entries
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkIdleUsers() {
    try {
      this.pinoLogger.debug('Running idle detection check');

      // Находим все компании с включенной детекцией простоя
      const companies = await this.prisma.company.findMany({
        where: {
          idleDetectionEnabled: true,
        },
        select: {
          id: true,
          idleThreshold: true,
        },
      });

      for (const company of companies) {
        // Находим всех уникальных пользователей с активными time entries
        // Используем группировку через findMany с последующей дедупликацией
        const activeEntries = await this.prisma.timeEntry.findMany({
          where: {
            status: 'RUNNING',
            user: {
              companyId: company.id,
              status: 'ACTIVE',
            },
          },
          select: {
            userId: true,
          },
        });

        // Получаем уникальные userId
        const uniqueUserIds = [...new Set(activeEntries.map(e => e.userId))];

        // Ограничиваем количество параллельных запросов для предотвращения перегрузки БД
        // Обрабатываем пользователей батчами по 10
        const BATCH_SIZE = 10;
        for (let i = 0; i < uniqueUserIds.length; i += BATCH_SIZE) {
          const batch = uniqueUserIds.slice(i, i + BATCH_SIZE);
          
          // Обрабатываем батч параллельно
          const batchResults = await Promise.allSettled(
            batch.map(userId => this.pauseTimeEntryIfIdle(userId, company.id))
          );

          // Логируем ошибки из батча
          batchResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              this.pinoLogger.error(
                { userId: batch[index], companyId: company.id, error: result.reason },
                'Failed to check idle for user',
              );
            }
          });
        }
      }

      this.pinoLogger.debug('Idle detection check completed');
    } catch (error) {
      this.pinoLogger.error({ error: error.message }, 'Error in idle detection cron job');
    }
  }

  /**
   * Получить статус активности пользователя
   */
  async getUserActivityStatus(userId: string, companyId: string) {
    // Проверяем существование пользователя, его принадлежность к компании и статус
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        status: 'ACTIVE', // Только активные пользователи могут получать статус
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in your company or inactive');
    }

    const userActivity = await this.prisma.userActivity.findUnique({
      where: { userId },
    });

    if (!userActivity) {
      return {
        isIdle: true,
        lastHeartbeat: null,
        secondsSinceLastHeartbeat: null,
        idleThreshold: null,
      };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        idleDetectionEnabled: true,
        idleThreshold: true,
      },
    });

      // Если компания не найдена, возвращаем дефолтные значения
      if (!company) {
        return {
          isIdle: false,
          lastHeartbeat: userActivity.lastHeartbeat,
          secondsSinceLastHeartbeat: null,
          idleThreshold: null,
        };
      }

      const now = new Date();
      const lastHeartbeat = new Date(userActivity.lastHeartbeat);
      const secondsSinceLastHeartbeat = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000);

      // Обрабатываем случай, когда lastHeartbeat в будущем (неправильные часы)
      const safeSecondsSinceLastHeartbeat = secondsSinceLastHeartbeat < 0 ? 0 : secondsSinceLastHeartbeat;

      const idleThresholdSeconds = company.idleThreshold ?? 300; // используем ?? вместо || для корректной обработки 0
      const isIdle = company.idleDetectionEnabled
        ? safeSecondsSinceLastHeartbeat > idleThresholdSeconds
        : false;

      return {
        isIdle,
        lastHeartbeat: userActivity.lastHeartbeat,
        secondsSinceLastHeartbeat: safeSecondsSinceLastHeartbeat,
        idleThreshold: idleThresholdSeconds,
      };
  }
}

