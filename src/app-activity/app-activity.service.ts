import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAppActivityDto } from "./dto/create-app-activity.dto";
import { BatchCreateAppActivityDto } from "./dto/batch-create-app-activity.dto";
import { UserRole } from "@prisma/client";

@Injectable()
export class AppActivityService {
  private readonly logger = new Logger(AppActivityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Создать запись о использовании приложения
   */
  async create(
    dto: CreateAppActivityDto,
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
    const sanitizedAppName = dto.appName.trim();
    const sanitizedWindowTitle = dto.windowTitle?.trim() || null;

    if (sanitizedAppName.length === 0) {
      throw new BadRequestException("App name cannot be empty");
    }

    // Проверяем существование time entry, права доступа и создаем запись в одной транзакции
    const appActivity = await this.prisma.$transaction(async (tx) => {
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
            "You can only create app activities for your own time entries",
          );
        }
      }

      // Создаем запись внутри транзакции для предотвращения race condition
      return tx.appActivity.create({
        data: {
          timeEntryId: dto.timeEntryId,
          userId,
          appName: sanitizedAppName,
          windowTitle: sanitizedWindowTitle,
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
        appActivityId: appActivity.id,
        appName: appActivity.appName,
        timeSpent: appActivity.timeSpent,
        userId,
      },
      "App activity created",
    );

    return appActivity;
  }

  /**
   * Batch создание записей о приложениях
   */
  async createBatch(
    dto: BatchCreateAppActivityDto,
    companyId: string,
    userId: string,
    userRole: UserRole,
  ) {
    if (dto.activities.length === 0) {
      throw new BadRequestException("At least one activity is required");
    }

    // Проверяем все time entries перед созданием
    const timeEntryIds = [
      ...new Set(dto.activities.map((activity) => activity.timeEntryId)),
    ];

    const timeEntries = await this.prisma.timeEntry.findMany({
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

    // Проверка прав для каждой записи
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
          "You can only create app activities for your own time entries",
        );
      }
    }

    // Валидация всех записей перед транзакцией
    for (const activity of dto.activities) {
      // Валидация времени
      if (activity.timeSpent < 0) {
        throw new BadRequestException(
          `Time spent cannot be negative for activity with app "${activity.appName}"`,
        );
      }

      if (activity.timeSpent > 86400) {
        throw new BadRequestException(
          `Time spent cannot exceed 24 hours (86400 seconds) for activity with app "${activity.appName}"`,
        );
      }

      // Валидация и обработка дат
      let startTime: Date = new Date();
      let endTime: Date | undefined;

      if (activity.startTime) {
        startTime = new Date(activity.startTime);
        if (isNaN(startTime.getTime())) {
          throw new BadRequestException(
            `Invalid startTime format for activity with app "${activity.appName}"`,
          );
        }
      }

      if (activity.endTime) {
        endTime = new Date(activity.endTime);
        if (isNaN(endTime.getTime())) {
          throw new BadRequestException(
            `Invalid endTime format for activity with app "${activity.appName}"`,
          );
        }
        if (endTime < startTime) {
          throw new BadRequestException(
            `endTime must be after startTime for activity with app "${activity.appName}"`,
          );
        }
      }

      // Санитизация и валидация appName
      const sanitizedAppName = activity.appName.trim();
      if (sanitizedAppName.length === 0) {
        throw new BadRequestException(
          `App name cannot be empty for activity at index ${dto.activities.indexOf(activity)}`,
        );
      }
    }

    // Создаем все записи в транзакции
    const created = await this.prisma.$transaction(async (tx) => {
      return Promise.all(
        dto.activities.map((activity) => {
          const sanitizedAppName = activity.appName.trim();
          const sanitizedWindowTitle = activity.windowTitle?.trim() || null;

          let startTime: Date = new Date();
          let endTime: Date | undefined;

          if (activity.startTime) {
            startTime = new Date(activity.startTime);
          }

          if (activity.endTime) {
            endTime = new Date(activity.endTime);
          }

          return tx.appActivity.create({
            data: {
              timeEntryId: activity.timeEntryId,
              userId,
              appName: sanitizedAppName,
              windowTitle: sanitizedWindowTitle,
              timeSpent: activity.timeSpent,
              startTime,
              endTime,
            },
          });
        }),
      );
    });

    this.logger.debug(
      {
        count: created.length,
        userId,
      },
      "Batch app activities created",
    );

    return {
      count: created.length,
      activities: created,
    };
  }

  /**
   * Получить статистику по приложениям для time entry
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
          "You can only view app activities for your own time entries",
        );
      }
    }

    // Получаем статистику
    const activities = await this.prisma.appActivity.findMany({
      where: {
        timeEntryId,
      },
      orderBy: {
        startTime: "desc",
      },
    });

    // Группируем по приложениям
    const statsByApp = activities.reduce(
      (acc, activity) => {
        const appName = activity.appName;
        if (!acc[appName]) {
          acc[appName] = {
            appName,
            totalTime: 0,
            count: 0,
            activities: [],
          };
        }
        acc[appName].totalTime += activity.timeSpent;
        acc[appName].count += 1;
        acc[appName].activities.push({
          id: activity.id,
          windowTitle: activity.windowTitle,
          timeSpent: activity.timeSpent,
          startTime: activity.startTime,
          endTime: activity.endTime,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          appName: string;
          totalTime: number;
          count: number;
          activities: Array<{
            id: string;
            windowTitle: string | null;
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
      apps: Object.values(statsByApp).sort((a, b) => b.totalTime - a.totalTime),
    };
  }

  /**
   * Получить статистику по приложениям для пользователя за период
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
            "You can only view your own app activity statistics",
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

    const activities = await this.prisma.appActivity.findMany({
      where,
      orderBy: {
        startTime: "desc",
      },
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

    // Группируем по приложениям
    const statsByApp = activities.reduce(
      (acc, activity) => {
        const appName = activity.appName;
        if (!acc[appName]) {
          acc[appName] = {
            appName,
            totalTime: 0,
            count: 0,
          };
        }
        acc[appName].totalTime += activity.timeSpent;
        acc[appName].count += 1;
        return acc;
      },
      {} as Record<
        string,
        {
          appName: string;
          totalTime: number;
          count: number;
        }
      >,
    );

    const totalTime = activities.reduce(
      (sum, activity) => sum + activity.timeSpent,
      0,
    );

    return {
      userId,
      period: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
      },
      totalTime,
      totalActivities: activities.length,
      apps: Object.values(statsByApp).sort((a, b) => b.totalTime - a.totalTime),
    };
  }
}
