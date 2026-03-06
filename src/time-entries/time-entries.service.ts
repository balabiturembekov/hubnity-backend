import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import {
  StartTimeEntryDto,
  StopTimeEntryDto,
  ManualTimeEntryDto,
  UpdateTimeEntryDto,
  TimeEntryFilterDto,
  TimeEntryResponseDto,
} from "./dto/create-time-entry.dto";
import {
  EntityNotFoundException,
  PermissionDeniedException,
  InvalidOperationException,
} from "../exceptions/business.exception";
import {
  ScreenshotFilterDto,
  ScreenshotResponseDto,
  UploadScreenshotDto,
} from "./dto/screenshot.dto";
import {
  AppActivityDto,
  AppActivityResponseDto,
  AppActivityFilterDto,
  AppCategory,
} from "./dto/app-activity.dto";
import { IdlePeriodDto, IdlePeriodResponseDto } from "./dto/idle.dto";
import { ApprovalService } from "./approval.service";

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  // Активные таймеры пользователей (в памяти)
  private activeTimers: Map<
    string,
    { startTime: Date; data: StartTimeEntryDto }
  > = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalService: ApprovalService,
  ) {}

  // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================

  private async validateProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId, status: "ACTIVE" },
            },
          },
        },
        members: {
          where: { userId },
        },
      },
    });

    if (!project) {
      throw new EntityNotFoundException("Project", projectId);
    }

    const isOrgMember = project.organization.members.length > 0;
    const isProjectMember = project.members.length > 0;
    const isOwner = project.organization.ownerId === userId;

    if (!isOrgMember && !isProjectMember && !isOwner) {
      throw new PermissionDeniedException(
        "You do not have access to this project",
      );
    }

    return project;
  }

  private async validateTimeEntryAccess(timeEntryId: string, userId: string) {
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      include: {
        project: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!timeEntry) {
      throw new EntityNotFoundException("TimeEntry", timeEntryId);
    }

    const isOwner = timeEntry.userId === userId;
    const isOrgOwner = timeEntry.project.organization.ownerId === userId;

    if (!isOwner && !isOrgOwner) {
      throw new PermissionDeniedException(
        "You do not have access to this time entry",
      );
    }

    return timeEntry;
  }

  // ==================== ОСНОВНЫЕ МЕТОДЫ ====================

  /**
   * Начать отсчет времени
   */
  async startTimer(
    userId: string,
    dto: StartTimeEntryDto,
  ): Promise<{ message: string; timerId: string }> {
    this.logger.log(
      `User ${userId} starting timer for project ${dto.projectId}`,
    );

    // Проверяем, нет ли уже активного таймера
    if (this.activeTimers.has(userId)) {
      throw new InvalidOperationException("You already have an active timer");
    }

    // Проверяем доступ к проекту
    await this.validateProjectAccess(dto.projectId, userId);

    // Сохраняем таймер в памяти
    const timerId = `timer_${Date.now()}_${userId}`;
    this.activeTimers.set(userId, {
      startTime: new Date(),
      data: dto,
    });

    this.logger.log(`Timer started for user ${userId}`);

    return {
      message: "Timer started successfully",
      timerId,
    };
  }

  /**
   * Остановить отсчет времени и сохранить запись
   */
  async stopTimer(
    userId: string,
    dto: StopTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    this.logger.log(`User ${userId} stopping timer`);

    // Проверяем, есть ли активный таймер
    const activeTimer = this.activeTimers.get(userId);
    if (!activeTimer) {
      throw new InvalidOperationException("No active timer found");
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - activeTimer.startTime.getTime()) / 1000,
    );

    try {
      // Создаем запись времени
      const timeEntry = await this.prisma.timeEntry.create({
        data: {
          startTime: activeTimer.startTime,
          endTime,
          duration,
          description: dto.description || activeTimer.data.description,
          billable: activeTimer.data.billable ?? true,
          userId,
          projectId: activeTimer.data.projectId,
          taskId: activeTimer.data.taskId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Удаляем таймер из памяти
      this.activeTimers.delete(userId);

      this.logger.log(
        `Timer stopped, time entry created with id ${timeEntry.id}`,
      );

      return this.mapToResponse(timeEntry);
    } catch (error) {
      this.logger.error(`Failed to stop timer: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Ручной ввод времени
   */
  async createManualEntry(
    userId: string,
    dto: ManualTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    this.logger.log(`User ${userId} creating manual time entry`);

    // Проверяем доступ к проекту
    await this.validateProjectAccess(dto.projectId, userId);

    // Валидация: startTime должен быть меньше endTime
    if (dto.startTime >= dto.endTime) {
      throw new InvalidOperationException("Start time must be before end time");
    }

    const duration = Math.floor(
      (dto.endTime.getTime() - dto.startTime.getTime()) / 1000,
    );

    try {
      const timeEntry = await this.prisma.timeEntry.create({
        data: {
          startTime: dto.startTime,
          endTime: dto.endTime,
          duration,
          description: dto.description,
          billable: dto.billable ?? true,
          userId,
          projectId: dto.projectId,
          taskId: dto.taskId,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return this.mapToResponse(timeEntry);
    } catch (error) {
      this.logger.error(
        `Failed to create manual time entry: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Получить все записи времени (с фильтрацией)
   */
  async getTimeEntries(
    userId: string,
    filters: TimeEntryFilterDto,
  ): Promise<TimeEntryResponseDto[]> {
    this.logger.log(`Fetching time entries for user ${userId}`);

    const where: Prisma.TimeEntryWhereInput = {};

    // Базовый фильтр - показываем только свои записи, если не админ
    // (упрощенно - пока только свои)
    where.userId = userId;

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.fromDate || filters.toDate) {
      where.startTime = {};
      if (filters.fromDate) {
        where.startTime.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.startTime.lte = filters.toDate;
      }
    }

    if (filters.billable !== undefined) {
      where.billable = filters.billable;
    }

    if (filters.approved !== undefined) {
      where.approved = filters.approved;
    }

    try {
      const timeEntries = await this.prisma.timeEntry.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          startTime: Prisma.SortOrder.desc,
        },
      });

      return timeEntries.map((entry) => this.mapToResponse(entry));
    } catch (error) {
      this.logger.error(
        `Failed to fetch time entries: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Получить запись времени по ID
   */
  async getTimeEntryById(
    id: string,
    userId: string,
  ): Promise<TimeEntryResponseDto> {
    this.logger.log(`Fetching time entry ${id}`);

    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            name: true,
          },
        },
        screenshots: {
          orderBy: { takenAt: "desc" },
        },
        activities: true,
      },
    });

    if (!timeEntry) {
      throw new EntityNotFoundException("TimeEntry", id);
    }

    // Проверяем доступ
    if (timeEntry.userId !== userId) {
      const project = await this.prisma.project.findUnique({
        where: { id: timeEntry.projectId },
        include: { organization: true },
      });

      if (project?.organization.ownerId !== userId) {
        throw new PermissionDeniedException(
          "You do not have access to this time entry",
        );
      }
    }

    return this.mapToResponse(timeEntry);
  }

  /**
   * Обновить запись времени
   */
  async updateTimeEntry(
    id: string,
    dto: UpdateTimeEntryDto,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TimeEntryResponseDto> {
    this.logger.log(`Updating time entry ${id}`);

    const timeEntry = await this.validateTimeEntryAccess(id, userId);

    if (timeEntry.locked) {
      throw new InvalidOperationException("Time entry is locked");
    }

    if (timeEntry.approved) {
      const canEditApproved = await this.approvalService.approveTimeEntries(
        userId,
        {
          timeEntryIds: [id],
          approved: false,
        },
      );

      if (!canEditApproved) {
        throw new PermissionDeniedException(
          "You are not allowed to edit this time entry",
        );
      }
    }

    const oldValues = {
      startTime: timeEntry.startTime,
      endTime: timeEntry.endTime,
      description: timeEntry.description,
      billable: timeEntry.billable,
      taskId: timeEntry.taskId,
      approved: timeEntry.approved,
    };
    const { reason, ...updateData } = dto;
    // Обновляем
    const updated = await this.prisma.timeEntry.update({
      where: { id },
      data: updateData,
    });

    // Если обновляются времена, проверяем их
    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime) {
      throw new InvalidOperationException("Start time must be before end time");
    }

    // Вычисляем новую длительность, если обновляются времена
    let duration: number | undefined;
    if (dto.startTime || dto.endTime) {
      const entry = await this.prisma.timeEntry.findUnique({
        where: { id },
        select: { startTime: true, endTime: true },
      });

      const startTime = dto.startTime || entry?.startTime;
      const endTime = dto.endTime || entry?.endTime;

      if (startTime && endTime) {
        duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
      }
    }

    try {
      const timeEntry = await this.prisma.timeEntry.update({
        where: { id },
        data: {
          startTime: dto.startTime,
          endTime: dto.endTime,
          duration,
          description: dto.description,
          billable: dto.billable,
          taskId: dto.taskId,
          approved: dto.approved,
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          task: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await this.approvalService.logTimeEntryChange(
        id,
        userId,
        oldValues,
        {
          startTime: dto.startTime,
          endTime: dto.endTime,
          description: dto.description,
          billable: dto.billable,
          taskId: dto.taskId,
        },
        dto.reason,
        ipAddress,
        userAgent,
      );

      return this.mapToResponse(timeEntry);
    } catch (error) {
      this.logger.error(
        `Failed to update time entry: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Удалить запись времени
   */
  async deleteTimeEntry(id: string, userId: string): Promise<void> {
    this.logger.log(`Deleting time entry ${id}`);

    // Проверяем доступ
    await this.validateTimeEntryAccess(id, userId);

    try {
      await this.prisma.timeEntry.delete({
        where: { id },
      });
      this.logger.log(`Time entry ${id} deleted`);
    } catch (error) {
      this.logger.error(
        `Failed to delete time entry: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Получить активный таймер пользователя
   */
  getActiveTimer(userId: string): {
    isActive: boolean;
    startTime?: Date;
    data?: StartTimeEntryDto;
  } {
    const timer = this.activeTimers.get(userId);
    if (!timer) {
      return { isActive: false };
    }
    return {
      isActive: true,
      startTime: timer.startTime,
      data: timer.data,
    };
  }

  async uploadScreenshot(
    timeEntryId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadScreenshotDto,
  ): Promise<ScreenshotResponseDto> {
    this.logger.log(`Uploading screenshot for time entry ${timeEntryId}`);

    // 1. Проверяем доступ к временной записи
    const timeEntry = await this.validateTimeEntryAccess(timeEntryId, userId);

    // 2. Здесь должна быть загрузка в S3 / MinIO / локальное хранилище
    // Пока сохраняем путь к файлу локально
    const fileName = `screenshots/${timeEntryId}/${Date.now()}.png`;
    const fileUrl = `/uploads/${fileName}`;

    // TODO: Реальная загрузка файла (сейчас просто симулируем)

    try {
      const screenshot = await this.prisma.screenshot.create({
        data: {
          url: fileUrl,
          takenAt: new Date(),
          isBlurred: dto.isBlurred ?? false,
          timeEntryId,
        },
        include: {
          timeEntry: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              description: true,
            },
          },
        },
      });

      // Если есть данные активности, создаем запись активности
      if (dto.activityData) {
        await this.prisma.activity.create({
          data: {
            trackedDate: new Date(),
            trackedSeconds: 60, // Период скриншота (обычно 1 минута)
            mousePercent: dto.activityData.mouseClicks
              ? Math.min(100, dto.activityData.mouseClicks * 10)
              : undefined,
            keyboardPercent: dto.activityData.keyboardStrokes
              ? Math.min(100, dto.activityData.keyboardStrokes * 10)
              : undefined,
            timeEntryId,
          },
        });
      }

      return this.mapToScreenshotResponse(screenshot);
    } catch (error) {
      this.logger.error(
        `Failed to upload screenshot: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getScreenshots(
    timeEntryId: string,
    userId: string,
    filter: ScreenshotFilterDto,
  ): Promise<ScreenshotResponseDto[]> {
    this.logger.log(`Fetching screenshots for time entry ${timeEntryId}`);

    // Проверяем доступ
    await this.validateTimeEntryAccess(timeEntryId, userId);

    const screenshots = await this.prisma.screenshot.findMany({
      where: { timeEntryId },
      orderBy: { takenAt: "desc" },
      take: filter.limit,
      skip: filter.offset,
    });

    return screenshots.map((s) => this.mapToScreenshotResponse(s));
  }

  async deleteScreenshot(screenshotId: string, userId: string): Promise<void> {
    this.logger.log(`Deleting screenshot ${screenshotId}`);

    // Находим скриншот
    const screenshot = await this.prisma.screenshot.findUnique({
      where: { id: screenshotId },
      include: { timeEntry: true },
    });

    if (!screenshot) {
      throw new EntityNotFoundException("Screenshot", screenshotId);
    }

    // Проверяем доступ (через временную запись)
    await this.validateTimeEntryAccess(screenshot.timeEntryId, userId);

    // TODO: Удалить физический файл из хранилища

    await this.prisma.screenshot.delete({
      where: { id: screenshotId },
    });

    this.logger.log(`Screenshot ${screenshotId} deleted`);
  }

  async recordIdlePeriod(
    timeEntryId: string,
    userId: string,
    dto: IdlePeriodDto,
  ): Promise<IdlePeriodResponseDto> {
    this.logger.log(`Recording idle period for time entry ${timeEntryId}`);

    // Проверяем доступ
    await this.validateTimeEntryAccess(timeEntryId, userId);

    // Если есть endTime, вычисляем duration
    let duration = dto.duration;
    if (dto.startTime && dto.endTime && !duration) {
      duration = Math.floor(
        (dto.endTime.getTime() - dto.startTime.getTime()) / 1000,
      );
    }

    const idlePeriod = await this.prisma.idlePeriod.create({
      data: {
        startTime: dto.startTime,
        endTime: dto.endTime,
        duration,
        reason: dto.reason,
        timeEntryId,
      },
    });

    // Если период бездействия закончился, обновляем общую длительность timeEntry?
    // TODO: Вычитать idle время из общего времени?

    return this.mapToIdlePeriodResponse(idlePeriod);
  }

  /**
   * Получить периоды бездействия для временной записи
   */
  async getIdlePeriods(
    timeEntryId: string,
    userId: string,
  ): Promise<IdlePeriodResponseDto[]> {
    this.logger.log(`Fetching idle periods for time entry ${timeEntryId}`);

    await this.validateTimeEntryAccess(timeEntryId, userId);

    const idlePeriods = await this.prisma.idlePeriod.findMany({
      where: { timeEntryId },
      orderBy: { startTime: "asc" },
    });

    return idlePeriods.map((p) => this.mapToIdlePeriodResponse(p));
  }

  // ==================== APP/URL TRACKING ====================

  /**
   * Записать активность приложения
   */
  async recordAppActivity(
    timeEntryId: string,
    userId: string,
    dto: AppActivityDto,
  ): Promise<AppActivityResponseDto> {
    this.logger.log(`Recording app activity for time entry ${timeEntryId}`);

    await this.validateTimeEntryAccess(timeEntryId, userId);

    let category: AppCategory | undefined;

    // Определяем категорию, если не указана
    if (!category && dto.domain) {
      category = this.categorizeDomain(dto.domain);
    } else if (!category && dto.appName) {
      category = this.categorizeApp(dto.appName);
    }

    const appActivity = await this.prisma.appActivity.create({
      data: {
        appName: dto.appName,
        windowTitle: dto.windowTitle,
        url: dto.url,
        domain: dto.domain,
        category,
        durationSeconds: dto.durationSeconds,
        trackedAt: dto.trackedAt,
        timeEntryId,
      },
    });

    return this.mapToAppActivityResponse(appActivity);
  }

  /**
   * Получить активность приложений для временной записи
   */
  async getAppActivities(
    timeEntryId: string,
    userId: string,
    filter: AppActivityFilterDto,
  ): Promise<AppActivityResponseDto[]> {
    this.logger.log(`Fetching app activities for time entry ${timeEntryId}`);

    await this.validateTimeEntryAccess(timeEntryId, userId);

    const where: Prisma.AppActivityWhereInput = { timeEntryId };

    if (filter.appName) {
      where.appName = { contains: filter.appName, mode: "insensitive" };
    }
    if (filter.domain) {
      where.domain = filter.domain;
    }
    if (filter.category) {
      where.category = filter.category;
    }

    const activities = await this.prisma.appActivity.findMany({
      where,
      orderBy: { trackedAt: "desc" },
      take: filter.limit,
    });

    return activities.map((a) => this.mapToAppActivityResponse(a));
  }

  /**
   * Получить агрегированную статистику по приложениям
   */
  async getAppStats(timeEntryId: string, userId: string): Promise<any> {
    this.logger.log(`Fetching app stats for time entry ${timeEntryId}`);

    await this.validateTimeEntryAccess(timeEntryId, userId);

    // Группировка по категориям
    const byCategory = await this.prisma.appActivity.groupBy({
      by: ["category"],
      where: { timeEntryId },
      _sum: { durationSeconds: true },
      _count: true,
    });

    // Группировка по приложениям
    const byApp = await this.prisma.appActivity.groupBy({
      by: ["appName"],
      where: { timeEntryId },
      _sum: { durationSeconds: true },
      _count: true,
      orderBy: {
        _sum: {
          durationSeconds: "desc",
        },
      },
      take: 10,
    });

    // Группировка по доменам
    const byDomain = await this.prisma.appActivity.groupBy({
      by: ["domain"],
      where: {
        timeEntryId,
        domain: { not: null },
      },
      _sum: { durationSeconds: true },
      _count: true,
      orderBy: {
        _sum: {
          durationSeconds: "desc",
        },
      },
      take: 10,
    });

    return {
      byCategory,
      byApp,
      byDomain,
    };
  }

  // ==================== IDLE DETECTION LOGIC ====================

  /**
   * Проверка на бездействие (вызывается периодически из контроллера)
   */
  async checkIdle(
    userId: string,
    lastActivityTimestamp: Date,
  ): Promise<{ isIdle: boolean; idleDuration?: number }> {
    const activeTimer = this.activeTimers.get(userId);

    if (!activeTimer) {
      return { isIdle: false };
    }

    const now = new Date();
    const idleThreshold = 5 * 60 * 1000; // 5 минут
    const timeSinceLastActivity =
      now.getTime() - lastActivityTimestamp.getTime();

    if (timeSinceLastActivity > idleThreshold) {
      return {
        isIdle: true,
        idleDuration: Math.floor(timeSinceLastActivity / 1000),
      };
    }

    return { isIdle: false };
  }

  // ==================== PRIVATE HELPERS ====================

  private categorizeDomain(domain: string): AppCategory {
    const productiveDomains = [
      "github.com",
      "gitlab.com",
      "stackoverflow.com",
      "docs.google.com",
      "jira.com",
      "trello.com",
    ];
    const unproductiveDomains = [
      "youtube.com",
      "twitter.com",
      "facebook.com",
      "instagram.com",
      "reddit.com",
      "twitch.tv",
    ];

    if (productiveDomains.some((d) => domain.includes(d))) {
      return AppCategory.PRODUCTIVE;
    }
    if (unproductiveDomains.some((d) => domain.includes(d))) {
      return AppCategory.UNPRODUCTIVE;
    }
    return AppCategory.NEUTRAL;
  }

  private categorizeApp(appName: string): AppCategory {
    const productiveApps = [
      "Visual Studio Code",
      "WebStorm",
      "IntelliJ",
      "Terminal",
      "iTerm",
      "Postman",
      "Docker",
      "Git",
    ];
    const communicationApps = ["Slack", "Teams", "Zoom", "Discord", "Telegram"];
    const designApps = ["Figma", "Sketch", "Photoshop", "Illustrator"];

    if (productiveApps.some((a) => appName.includes(a))) {
      return AppCategory.PRODUCTIVE;
    }
    if (communicationApps.some((a) => appName.includes(a))) {
      return AppCategory.COMMUNICATION;
    }
    if (designApps.some((a) => appName.includes(a))) {
      return AppCategory.DESIGN;
    }
    return AppCategory.NEUTRAL;
  }

  // ==================== MAPPERS ====================

  private mapToIdlePeriodResponse(period: any): IdlePeriodResponseDto {
    return {
      id: period.id,
      startTime: period.startTime,
      endTime: period.endTime,
      duration: period.duration,
      reason: period.reason,
      timeEntryId: period.timeEntryId,
    };
  }

  private mapToAppActivityResponse(activity: any): AppActivityResponseDto {
    return {
      id: activity.id,
      appName: activity.appName,
      windowTitle: activity.windowTitle,
      url: activity.url,
      domain: activity.domain,
      category: activity.category,
      durationSeconds: activity.durationSeconds,
      trackedAt: activity.trackedAt,
      timeEntryId: activity.timeEntryId,
    };
  }

  // ==================== МЕТОДЫ МАППИНГА ====================

  private mapToResponse(entry: any): TimeEntryResponseDto {
    return {
      id: entry.id,
      startTime: entry.startTime,
      endTime: entry.endTime,
      duration: entry.duration,
      description: entry.description,
      billable: entry.billable,
      approved: entry.approved,
      userId: entry.userId,
      projectId: entry.projectId,
      taskId: entry.taskId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      user: entry.user,
      project: entry.project,
      task: entry.task,
    };
  }

  private mapToScreenshotResponse(screenshot: any): ScreenshotResponseDto {
    return {
      id: screenshot.id,
      url: screenshot.url,
      takenAt: screenshot.takenAt,
      isBlurred: screenshot.isBlurred,
      timeEntryId: screenshot.timeEntryId,
      timeEntry: screenshot.timeEntry,
    };
  }
}
