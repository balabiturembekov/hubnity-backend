import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUrlActivityDto } from "./dto/create-url-activity.dto";
import { BatchCreateUrlActivityDto } from "./dto/batch-create-url-activity.dto";
import { UserRole, Prisma } from "@prisma/client";

@Injectable()
export class UrlActivityService {
  private readonly logger = new Logger(UrlActivityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Проверка, заблокирован ли URL (синхронная версия для использования с предзагруженными данными)
   */
  private isUrlBlockedSync(
    url: string,
    domain: string,
    blockedUrls: Array<{
      url: string | null;
      domain: string | null;
      pattern: string | null;
    }>,
  ): boolean {
    if (!url || !domain) {
      return false;
    }

    // Нормализуем URL для сравнения (приводим к lowercase)
    const normalizedUrlForComparison = url.toLowerCase();

    for (const blocked of blockedUrls) {
      // Проверка точного URL (case-insensitive)
      if (
        blocked.url &&
        normalizedUrlForComparison === blocked.url.toLowerCase()
      ) {
        return true;
      }

      // Проверка домена (оба должны быть в lowercase)
      if (
        blocked.domain &&
        domain.toLowerCase() === blocked.domain.toLowerCase()
      ) {
        return true;
      }

      // Проверка regex паттерна
      if (blocked.pattern) {
        try {
          // Ограничение времени выполнения regex для предотвращения ReDoS
          // Ограничиваем длину входной строки для проверки
          if (url.length > 10000) {
            // Слишком длинный URL, пропускаем regex проверку
            continue;
          }
          const regex = new RegExp(blocked.pattern);
          if (regex.test(url)) {
            return true;
          }
        } catch (error) {
          this.logger.warn(
            { pattern: blocked.pattern, error },
            "Invalid regex pattern in blocked URL",
          );
        }
      }
    }

    return false;
  }

  /**
   * Проверка, заблокирован ли URL (асинхронная версия для использования в транзакциях)
   */
  private async isUrlBlocked(
    url: string,
    domain: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const prisma = tx || this.prisma;

    const blockedUrls = await prisma.blockedUrl.findMany({
      where: {
        companyId,
      },
    });

    return this.isUrlBlockedSync(url, domain, blockedUrls);
  }

  /**
   * Извлечение домена из URL
   */
  private extractDomain(url: string): string {
    if (!url || url.trim().length === 0) {
      throw new BadRequestException("URL cannot be empty");
    }

    // Проверка максимальной длины URL перед обработкой
    if (url.length > 2048) {
      throw new BadRequestException("URL cannot exceed 2048 characters");
    }

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.replace(/^www\./, "");
      if (!domain || domain.length === 0) {
        throw new BadRequestException("Cannot extract domain from URL");
      }
      if (domain.length > 255) {
        throw new BadRequestException("Domain cannot exceed 255 characters");
      }
      return domain;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid URL format: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Создать запись о использовании URL
   */
  async create(
    dto: CreateUrlActivityDto,
    companyId: string,
    userId: string,
    userRole: UserRole,
  ) {
    // Валидация времени (выполняем ДО транзакции для эффективности)
    if (dto.timeSpent < 0) {
      throw new BadRequestException("Time spent cannot be negative");
    }

    if (dto.timeSpent > 86400) {
      throw new BadRequestException(
        "Time spent cannot exceed 24 hours (86400 seconds)",
      );
    }

    // Валидация и нормализация URL
    const normalizedUrl = dto.url.trim();
    if (normalizedUrl.length === 0) {
      throw new BadRequestException("URL cannot be empty");
    }
    if (normalizedUrl.length > 2048) {
      throw new BadRequestException("URL cannot exceed 2048 characters");
    }

    let normalizedDomain = dto.domain?.trim().toLowerCase() || "";

    // Если домен не указан, извлекаем из URL
    if (!normalizedDomain || normalizedDomain.length === 0) {
      normalizedDomain = this.extractDomain(normalizedUrl);
    }

    if (normalizedDomain.length === 0) {
      throw new BadRequestException("Domain cannot be empty");
    }
    if (normalizedDomain.length > 255) {
      throw new BadRequestException("Domain cannot exceed 255 characters");
    }

    // Валидация дат
    let startTime: Date | undefined;
    let endTime: Date | undefined;

    if (dto.startTime) {
      startTime = new Date(dto.startTime);
      if (isNaN(startTime.getTime())) {
        throw new BadRequestException("Invalid startTime format");
      }
    } else {
      startTime = new Date();
    }

    if (dto.endTime) {
      endTime = new Date(dto.endTime);
      if (isNaN(endTime.getTime())) {
        throw new BadRequestException("Invalid endTime format");
      }
      if (endTime < startTime) {
        throw new BadRequestException("endTime must be after startTime");
      }
    }

    // Санитизация данных
    const sanitizedTitle = dto.title?.trim() || null;

    // Проверяем существование time entry, права доступа, блокировку URL и создаем запись в одной транзакции
    const urlActivity = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.timeEntry.findFirst({
        where: {
          id: dto.timeEntryId,
          user: {
            companyId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!entry) {
        throw new NotFoundException(
          `Time entry with ID ${dto.timeEntryId} not found`,
        );
      }

      // Проверка прав: сотрудники могут создавать только для своих записей
      if (
        userRole !== UserRole.OWNER &&
        userRole !== UserRole.ADMIN &&
        userRole !== UserRole.SUPER_ADMIN
      ) {
        if (entry.userId !== userId) {
          throw new ForbiddenException(
            "You can only create URL activities for your own time entries",
          );
        }
      }

      // Проверка на заблокированные URL
      const isBlocked = await this.isUrlBlocked(
        normalizedUrl,
        normalizedDomain,
        companyId,
        tx,
      );

      if (isBlocked) {
        throw new ForbiddenException(
          `URL "${normalizedUrl}" is blocked by company policy`,
        );
      }

      // Создаем запись внутри транзакции для предотвращения race condition
      return tx.urlActivity.create({
        data: {
          timeEntryId: dto.timeEntryId,
          userId,
          url: normalizedUrl,
          domain: normalizedDomain,
          title: sanitizedTitle,
          timeSpent: dto.timeSpent,
          startTime,
          endTime,
        },
        include: {
          timeEntry: {
            select: {
              id: true,
              description: true,
              status: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });

    this.logger.debug(
      {
        urlActivityId: urlActivity.id,
        url: urlActivity.url,
        domain: urlActivity.domain,
        timeSpent: urlActivity.timeSpent,
        userId,
      },
      "URL activity created",
    );

    return urlActivity;
  }

  /**
   * Batch создание записей о URL
   */
  async createBatch(
    dto: BatchCreateUrlActivityDto,
    companyId: string,
    userId: string,
    userRole: UserRole,
  ) {
    if (dto.activities.length === 0) {
      throw new BadRequestException("At least one activity is required");
    }

    // Загружаем заблокированные URL один раз для эффективности
    const blockedUrls = await this.prisma.blockedUrl.findMany({
      where: {
        companyId,
      },
    });

    // Валидация всех записей перед транзакцией
    for (const activity of dto.activities) {
      // Валидация времени
      if (activity.timeSpent < 0) {
        throw new BadRequestException(
          `Time spent cannot be negative for activity with URL "${activity.url}"`,
        );
      }

      if (activity.timeSpent > 86400) {
        throw new BadRequestException(
          `Time spent cannot exceed 24 hours (86400 seconds) for activity with URL "${activity.url}"`,
        );
      }

      // Валидация и обработка дат
      let startTime: Date = new Date();
      let endTime: Date | undefined;

      if (activity.startTime) {
        startTime = new Date(activity.startTime);
        if (isNaN(startTime.getTime())) {
          throw new BadRequestException(
            `Invalid startTime format for activity with URL "${activity.url}"`,
          );
        }
      }

      if (activity.endTime) {
        endTime = new Date(activity.endTime);
        if (isNaN(endTime.getTime())) {
          throw new BadRequestException(
            `Invalid endTime format for activity with URL "${activity.url}"`,
          );
        }
        if (endTime < startTime) {
          throw new BadRequestException(
            `endTime must be after startTime for activity with URL "${activity.url}"`,
          );
        }
      }

      // Валидация URL
      const normalizedUrl = activity.url.trim();
      if (normalizedUrl.length === 0) {
        throw new BadRequestException(
          `URL cannot be empty for activity at index ${dto.activities.indexOf(activity)}`,
        );
      }
      if (normalizedUrl.length > 2048) {
        throw new BadRequestException(
          `URL cannot exceed 2048 characters for activity at index ${dto.activities.indexOf(activity)}`,
        );
      }
    }

    // Создаем все записи в транзакции
    const created = await this.prisma.$transaction(async (tx) => {
      // Проверяем все time entries внутри транзакции для предотвращения race condition
      const timeEntryIds = [
        ...new Set(dto.activities.map((activity) => activity.timeEntryId)),
      ];

      const timeEntries = await tx.timeEntry.findMany({
        where: {
          id: {
            in: timeEntryIds,
          },
          user: {
            companyId,
          },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (timeEntries.length !== timeEntryIds.length) {
        throw new NotFoundException("One or more time entries not found");
      }

      // Проверка прав для каждой записи внутри транзакции
      if (
        userRole !== UserRole.OWNER &&
        userRole !== UserRole.ADMIN &&
        userRole !== UserRole.SUPER_ADMIN
      ) {
        const invalidEntries = timeEntries.filter(
          (entry) => entry.userId !== userId,
        );
        if (invalidEntries.length > 0) {
          throw new ForbiddenException(
            "You can only create URL activities for your own time entries",
          );
        }
      }

      const results: Prisma.UrlActivityGetPayload<Record<string, never>>[] = [];
      const skipped: Array<{
        index: number;
        url: string;
        reason: string;
      }> = [];

      for (let index = 0; index < dto.activities.length; index++) {
        const activity = dto.activities[index];
        // Нормализация URL и домена
        const normalizedUrl = activity.url.trim();
        let normalizedDomain = activity.domain?.trim().toLowerCase() || "";

        if (!normalizedDomain || normalizedDomain.length === 0) {
          try {
            normalizedDomain = this.extractDomain(normalizedUrl);
          } catch (error) {
            this.logger.warn(
              {
                url: normalizedUrl,
                error: (error as Error).message,
                activityIndex: index,
              },
              "Skipping activity with invalid URL",
            );
            skipped.push({
              index,
              url: normalizedUrl,
              reason: `Invalid URL format: ${(error as Error).message}`,
            });
            continue; // Пропускаем эту запись
          }
        }

        if (normalizedDomain.length === 0 || normalizedDomain.length > 255) {
          this.logger.warn(
            {
              domain: normalizedDomain,
              activityIndex: index,
            },
            "Skipping activity with invalid domain",
          );
          skipped.push({
            index,
            url: normalizedUrl,
            reason: `Invalid domain: ${normalizedDomain.length === 0 ? "empty" : "exceeds 255 characters"}`,
          });
          continue; // Пропускаем эту запись
        }

        // Проверка на заблокированные URL (используем предзагруженный список)
        const isBlocked = this.isUrlBlockedSync(
          normalizedUrl,
          normalizedDomain,
          blockedUrls,
        );

        if (isBlocked) {
          this.logger.warn(
            {
              url: normalizedUrl,
              domain: normalizedDomain,
              userId,
              companyId,
            },
            "Skipping blocked URL in batch",
          );
          skipped.push({
            index,
            url: normalizedUrl,
            reason: "URL is blocked by company policy",
          });
          continue; // Пропускаем заблокированные URL
        }

        const sanitizedTitle = activity.title?.trim() || null;
        if (sanitizedTitle && sanitizedTitle.length > 500) {
          this.logger.warn(
            {
              title: sanitizedTitle,
              activityIndex: index,
            },
            "Title exceeds maximum length, truncating",
          );
          skipped.push({
            index,
            url: normalizedUrl,
            reason: "Title exceeds 500 characters",
          });
          continue; // Пропускаем эту запись
        }

        let startTime: Date = new Date();
        let endTime: Date | undefined;

        if (activity.startTime) {
          startTime = new Date(activity.startTime);
        }

        if (activity.endTime) {
          endTime = new Date(activity.endTime);
        }

        // Создаем запись
        try {
          const result = await tx.urlActivity.create({
            data: {
              timeEntryId: activity.timeEntryId,
              userId,
              url: normalizedUrl,
              domain: normalizedDomain,
              title: sanitizedTitle,
              timeSpent: activity.timeSpent,
              startTime,
              endTime,
            },
          });
          results.push(result);
        } catch (error) {
          this.logger.error(
            {
              url: normalizedUrl,
              error: (error as Error).message,
              activityIndex: index,
            },
            "Failed to create URL activity",
          );
          skipped.push({
            index,
            url: normalizedUrl,
            reason: `Database error: ${(error as Error).message}`,
          });
        }
      }

      return { results, skipped };
    });

    const createdCount = created.results.length;
    const skippedCount = created.skipped.length;

    this.logger.debug(
      {
        count: createdCount,
        skipped: skippedCount,
        requested: dto.activities.length,
        userId,
      },
      "Batch URL activities created",
    );

    if (createdCount === 0 && skippedCount > 0) {
      this.logger.warn(
        {
          skipped: created.skipped,
          userId,
        },
        "All URL activities were skipped in batch",
      );
    }

    return {
      count: createdCount,
      skipped: skippedCount,
      activities: created.results,
      skippedDetails: created.skipped.length > 0 ? created.skipped : undefined,
    };
  }

  /**
   * Получить статистику по URL для time entry
   */
  async getStatsByTimeEntry(
    timeEntryId: string,
    companyId: string,
    userId: string,
    userRole: UserRole,
  ) {
    // Проверяем существование time entry и права доступа
    const timeEntry = await this.prisma.timeEntry.findFirst({
      where: {
        id: timeEntryId,
        user: {
          companyId,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!timeEntry) {
      throw new NotFoundException(
        `Time entry with ID ${timeEntryId} not found`,
      );
    }

    // Проверка прав
    if (
      userRole !== UserRole.OWNER &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.SUPER_ADMIN
    ) {
      if (timeEntry.userId !== userId) {
        throw new ForbiddenException(
          "You can only view URL activities for your own time entries",
        );
      }
    }

    // Получаем статистику (с лимитом для производительности)
    const activities = await this.prisma.urlActivity.findMany({
      where: {
        timeEntryId,
      },
      orderBy: {
        startTime: "desc",
      },
      take: 10000, // Лимит на количество записей
    });

    // Ранний возврат, если нет данных
    if (activities.length === 0) {
      return {
        timeEntryId,
        totalTime: 0,
        totalActivities: 0,
        domains: [],
      };
    }

    // Группируем по доменам
    const statsByDomain = activities.reduce(
      (acc, activity) => {
        // Обработка null/undefined domain
        const domain = activity.domain || "unknown";

        // Проверка валидности timeSpent
        const timeSpent =
          isFinite(activity.timeSpent) && activity.timeSpent >= 0
            ? activity.timeSpent
            : 0;

        if (!acc[domain]) {
          acc[domain] = {
            domain,
            totalTime: 0,
            count: 0,
            activities: [],
          };
        }
        acc[domain].totalTime += timeSpent;
        acc[domain].count += 1;
        acc[domain].activities.push({
          id: activity.id,
          url: activity.url,
          title: activity.title,
          timeSpent: activity.timeSpent,
          startTime: activity.startTime,
          endTime: activity.endTime,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          domain: string;
          totalTime: number;
          count: number;
          activities: Array<{
            id: string;
            url: string;
            title: string | null;
            timeSpent: number;
            startTime: Date;
            endTime: Date | null;
          }>;
        }
      >,
    );

    const totalTime = activities.reduce(
      (sum, activity) => sum + activity.timeSpent,
      0,
    );

    return {
      timeEntryId,
      totalTime,
      totalActivities: activities.length,
      domains: Object.values(statsByDomain)
        .map((domain) => ({
          ...domain,
          totalTime: Math.min(domain.totalTime, Number.MAX_SAFE_INTEGER),
        }))
        .sort(
          (a, b) =>
            b.totalTime - a.totalTime || a.domain.localeCompare(b.domain),
        )
        .slice(0, 100), // Ограничиваем топ-100 доменов
    };
  }

  /**
   * Получить статистику по URL для пользователя за период
   */
  async getUserStats(
    userId: string,
    companyId: string,
    startDate?: Date,
    endDate?: Date,
    requestingUserId?: string,
    requestingUserRole?: UserRole,
  ) {
    // Проверка прав: можно запрашивать только свои данные (кроме админов)
    if (requestingUserId && requestingUserRole) {
      if (
        requestingUserRole !== UserRole.OWNER &&
        requestingUserRole !== UserRole.ADMIN &&
        requestingUserRole !== UserRole.SUPER_ADMIN
      ) {
        if (requestingUserId !== userId) {
          throw new ForbiddenException(
            "You can only view your own URL activity statistics",
          );
        }
      }
    }

    // Проверяем, что пользователь существует и принадлежит компании
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Валидация диапазона дат
    if (startDate && endDate) {
      if (endDate < startDate) {
        throw new BadRequestException(
          "endDate must be greater than or equal to startDate",
        );
      }

      // Проверка максимального диапазона (10 лет)
      const maxRange = 10 * 365 * 24 * 60 * 60 * 1000; // 10 лет в миллисекундах
      const range = endDate.getTime() - startDate.getTime();
      if (range > maxRange) {
        throw new BadRequestException("Date range cannot exceed 10 years");
      }

      // Проверка на будущие даты (максимум 1 час в будущем для допуска на рассинхронизацию часов)
      const maxFuture = new Date();
      maxFuture.setHours(maxFuture.getHours() + 1);
      if (startDate > maxFuture || endDate > maxFuture) {
        throw new BadRequestException(
          "Dates cannot be more than 1 hour in the future",
        );
      }
    }

    // Строим фильтр по датам
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId,
      timeEntry: {
        user: {
          companyId,
        },
      },
    };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = startDate;
      }
      if (endDate) {
        where.startTime.lte = endDate;
      }
    }

    const activities = await this.prisma.urlActivity.findMany({
      where,
      orderBy: {
        startTime: "desc",
      },
      take: 10000, // Лимит на количество записей
      include: {
        timeEntry: {
          select: {
            id: true,
            projectId: true,
            description: true,
          },
        },
      },
    });

    // Ранний возврат, если нет данных
    if (activities.length === 0) {
      return {
        userId,
        period: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString(),
        },
        totalTime: 0,
        totalActivities: 0,
        domains: [],
      };
    }

    // Группируем по доменам
    const statsByDomain = activities.reduce(
      (acc, activity) => {
        // Обработка null/undefined domain
        const domain = activity.domain || "unknown";

        // Проверка валидности timeSpent
        const timeSpent =
          isFinite(activity.timeSpent) && activity.timeSpent >= 0
            ? activity.timeSpent
            : 0;

        if (!acc[domain]) {
          acc[domain] = {
            domain,
            totalTime: 0,
            count: 0,
          };
        }
        acc[domain].totalTime += timeSpent;
        acc[domain].count += 1;
        return acc;
      },
      {} as Record<
        string,
        {
          domain: string;
          totalTime: number;
          count: number;
        }
      >,
    );

    const totalTime = activities.reduce((sum, activity) => {
      const timeSpent =
        isFinite(activity.timeSpent) && activity.timeSpent >= 0
          ? activity.timeSpent
          : 0;
      const newSum = sum + timeSpent;
      // Проверка на переполнение
      if (!isFinite(newSum) || newSum > Number.MAX_SAFE_INTEGER) {
        this.logger.warn(
          {
            userId,
            currentSum: sum,
            timeSpent,
            newSum,
          },
          "Total time exceeds safe integer limit, capping at MAX_SAFE_INTEGER",
        );
        return Number.MAX_SAFE_INTEGER;
      }
      return newSum;
    }, 0);

    return {
      userId,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      totalTime,
      totalActivities: activities.length,
      domains: Object.values(statsByDomain)
        .map((domain) => ({
          ...domain,
          totalTime: Math.min(domain.totalTime, Number.MAX_SAFE_INTEGER),
        }))
        .sort(
          (a, b) =>
            b.totalTime - a.totalTime || a.domain.localeCompare(b.domain),
        )
        .slice(0, 100), // Ограничиваем топ-100 доменов
    };
  }
}
