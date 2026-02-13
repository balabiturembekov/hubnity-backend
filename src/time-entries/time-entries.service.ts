import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { EventsGateway } from "../events/events.gateway";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { UserRole } from "@prisma/client";

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {}

  async create(
    dto: CreateTimeEntryDto,
    companyId: string,
    _creatorId: string,
    _creatorRole: UserRole,
  ) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${dto.userId} not found in your company`,
      );
    }

    if (user.status !== "ACTIVE") {
      throw new BadRequestException(
        "Cannot create time entry for inactive user",
      );
    }

    // CRITICAL: For employees, project is required
    if (user.role === UserRole.EMPLOYEE && !dto.projectId) {
      throw new BadRequestException(
        "Project is required for employees. Please select a project before starting the timer.",
      );
    }

    // Проверка проекта будет выполнена в транзакции для предотвращения race condition

    const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
    const maxFutureTime = new Date();
    maxFutureTime.setHours(maxFutureTime.getHours() + 1);
    if (startTime > maxFutureTime) {
      throw new BadRequestException(
        "Start time cannot be more than 1 hour in the future",
      );
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Проверяем проект в транзакции для предотвращения race condition
      if (dto.projectId) {
        const project = await tx.project.findFirst({
          where: {
            id: dto.projectId,
            companyId,
          },
        });

        if (!project) {
          throw new NotFoundException(
            `Project with ID ${dto.projectId} not found in your company`,
          );
        }

        if (project.status === "ARCHIVED") {
          throw new BadRequestException(
            "Cannot create time entry for archived project",
          );
        }
      }

      const activeEntryCheck = await tx.timeEntry.findFirst({
        where: {
          userId: dto.userId,
          status: {
            in: ["RUNNING", "PAUSED"],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntryCheck) {
        throw new BadRequestException(
          "User already has an active time entry. Please stop or pause the existing entry first.",
        );
      }

      const newEntry = await tx.timeEntry.create({
        data: {
          userId: dto.userId,
          projectId: dto.projectId,
          startTime,
          description: dto.description,
          status: dto.status || "RUNNING",
          duration: 0,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const activity = await tx.activity.create({
        data: {
          userId: dto.userId,
          projectId: dto.projectId,
          type: "START",
        },
      });

      return {
        entry: newEntry,
        activityId: activity.id,
        activityTimestamp: activity.timestamp,
      };
    });

    const entry = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    // Обрабатываем ошибки broadcast (не критично, но логируем)
    try {
      if (entry.user && entry.user.name) {
        this.eventsGateway.broadcastActivity(
          {
            id: activityId,
            userId: entry.userId,
            userName: entry.user.name,
            userAvatar: entry.user.avatar ?? undefined,
            type: "START",
            projectId: entry.projectId ?? undefined,
            timestamp: activityTimestamp.toISOString(),
          },
          companyId,
        );
      } else {
        this.logger.error(
          `Failed to broadcast activity ${activityId}: user data missing`,
          {
            entryId: entry.id,
            userId: entry.userId,
          },
        );
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        { activityId, entryId: entry.id, error: errorMessage },
        "Failed to broadcast activity",
      );
    }

    try {
      this.eventsGateway.broadcastTimeEntryUpdate(entry, companyId);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        { entryId: entry.id, error: errorMessage },
        "Failed to broadcast time entry update",
      );
    }

    // Сбрасываем isIdle в false при создании нового time entry
    try {
      await this.prisma.userActivity.updateMany({
        where: { userId: entry.userId },
        data: { isIdle: false },
      });
    } catch (error: unknown) {
      // Если не удалось обновить isIdle, логируем, но не критично
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { userId: entry.userId, error: errorMessage },
        "Failed to reset isIdle when creating time entry",
      );
    }

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate(
        { trigger: "time-entry-created" },
        companyId,
      );
    }, 1000);

    return entry;
  }

  async findAll(
    companyId: string,
    userId?: string,
    projectId?: string,
    limit: number = 100,
  ) {
    const where: {
      user: { companyId: string };
      userId?: string;
      projectId?: string;
    } = {
      user: {
        companyId,
      },
    };

    if (userId) {
      // Validate that userId belongs to the same company to prevent data leakage
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${userId} not found in your company`,
        );
      }

      where.userId = userId;
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          companyId,
        },
      });

      if (!project) {
        throw new NotFoundException(
          `Project with ID ${projectId} not found in your company`,
        );
      }

      where.projectId = projectId;
    }

    return this.prisma.timeEntry.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
    });
  }

  async findActive(companyId: string, userId?: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      status: {
        in: ["RUNNING", "PAUSED"],
      },
      user: {
        companyId,
      },
    };

    if (userId) {
      // Validate that userId belongs to the same company to prevent data leakage
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${userId} not found in your company`,
        );
      }

      where.userId = userId;
    }

    return this.prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });
  }

  async findOne(id: string, companyId: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id,
        user: {
          companyId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Time entry with ID ${id} not found`);
    }

    return entry;
  }

  async findPending(companyId: string, userId?: string, limit: number = 100) {
    const where: {
      user: { companyId: string };
      userId?: string;
      status: "STOPPED";
      approvalStatus: "PENDING";
    } = {
      user: { companyId },
      status: "STOPPED",
      approvalStatus: "PENDING",
    };

    if (userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: userId, companyId },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${userId} not found in your company`,
        );
      }
      where.userId = userId;
    }

    return this.prisma.timeEntry.findMany({
      where,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { startTime: "desc" },
    });
  }

  async approve(entryId: string, companyId: string, approverId: string) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        user: { companyId },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Time entry with ID ${entryId} not found`);
    }

    if (entry.approvalStatus !== "PENDING") {
      throw new BadRequestException(
        `Time entry is not pending approval (current status: ${entry.approvalStatus})`,
      );
    }

    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        approvalStatus: "APPROVED",
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionComment: null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    return updated;
  }

  async reject(
    entryId: string,
    companyId: string,
    approverId: string,
    rejectionComment?: string,
  ) {
    const entry = await this.prisma.timeEntry.findFirst({
      where: {
        id: entryId,
        user: { companyId },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Time entry with ID ${entryId} not found`);
    }

    if (entry.approvalStatus !== "PENDING") {
      throw new BadRequestException(
        `Time entry is not pending approval (current status: ${entry.approvalStatus})`,
      );
    }

    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: {
        approvalStatus: "REJECTED",
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionComment: rejectionComment ?? null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
    });

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    return updated;
  }

  async bulkApprove(ids: string[], companyId: string, approverId: string) {
    const result = await this.prisma.timeEntry.updateMany({
      where: {
        id: { in: ids },
        user: { companyId },
        approvalStatus: "PENDING",
      },
      data: {
        approvalStatus: "APPROVED",
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionComment: null,
      },
    });

    this.eventsGateway.broadcastStatsUpdate({ companyId }, companyId);
    return { approvedCount: result.count };
  }

  async bulkReject(
    ids: string[],
    companyId: string,
    approverId: string,
    rejectionComment?: string,
  ) {
    const result = await this.prisma.timeEntry.updateMany({
      where: {
        id: { in: ids },
        user: { companyId },
        approvalStatus: "PENDING",
      },
      data: {
        approvalStatus: "REJECTED",
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionComment: rejectionComment ?? null,
      },
    });

    this.eventsGateway.broadcastStatsUpdate({ companyId }, companyId);
    return { rejectedCount: result.count };
  }

  async update(
    id: string,
    dto: UpdateTimeEntryDto,
    companyId: string,
    updaterId: string,
    updaterRole: UserRole,
  ) {
    // Validate input data before transaction
    if (dto.startTime) {
      const newStartTime = new Date(dto.startTime);
      const maxFutureTime = new Date();
      maxFutureTime.setHours(maxFutureTime.getHours() + 1);
      if (newStartTime > maxFutureTime) {
        throw new BadRequestException(
          "Start time cannot be more than 1 hour in the future",
        );
      }
    }

    if (dto.duration !== undefined) {
      if (dto.duration < 0) {
        throw new BadRequestException("Duration cannot be negative");
      }
      if (dto.duration > 2147483647) {
        throw new BadRequestException(
          "Duration exceeds maximum allowed value (68+ years)",
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Read current entry within transaction to ensure consistency
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
      });

      if (!currentEntry) {
        throw new NotFoundException(`Time entry with ID ${id} not found`);
      }

      // Check permissions within transaction to prevent race conditions
      if (
        updaterRole !== UserRole.OWNER &&
        updaterRole !== UserRole.ADMIN &&
        updaterRole !== UserRole.SUPER_ADMIN
      ) {
        if (currentEntry.userId !== updaterId) {
          throw new ForbiddenException(
            "You can only update your own time entries",
          );
        }
      }

      // Build update data using current entry data from transaction
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = { ...dto };

      if (dto.endTime) {
        updateData.endTime = new Date(dto.endTime);
      }

      if (dto.startTime) {
        updateData.startTime = new Date(dto.startTime);
      }

      const finalStartTime = updateData.startTime
        ? new Date(updateData.startTime)
        : new Date(currentEntry.startTime);
      const finalEndTime = updateData.endTime
        ? new Date(updateData.endTime)
        : null;

      if (finalEndTime && finalEndTime <= finalStartTime) {
        throw new BadRequestException("End time must be after start time");
      }

      // Calculate duration based on current entry status (from transaction)
      if (dto.endTime && currentEntry.status === "RUNNING") {
        const start = finalStartTime.getTime();
        const end = finalEndTime
          ? finalEndTime.getTime()
          : new Date().getTime();
        const calculatedDuration =
          Math.floor((end - start) / 1000) + currentEntry.duration;

        if (calculatedDuration < 0) {
          throw new BadRequestException(
            "Calculated duration cannot be negative. Please check startTime and endTime values.",
          );
        }

        updateData.duration = calculatedDuration;
        updateData.status = "STOPPED";
      }

      if (dto.status === "STOPPED" && currentEntry.status !== "STOPPED") {
        if (!dto.endTime) {
          updateData.endTime = new Date();
        }

        if (!dto.duration) {
          const end = updateData.endTime
            ? new Date(updateData.endTime).getTime()
            : new Date().getTime();

          if (currentEntry.status === "RUNNING") {
            const currentSessionStart = new Date(
              currentEntry.startTime,
            ).getTime();
            const currentSessionSeconds = Math.floor(
              (end - currentSessionStart) / 1000,
            );
            updateData.duration =
              (currentEntry.duration || 0) + currentSessionSeconds;
          } else if (currentEntry.status === "PAUSED") {
            updateData.duration = currentEntry.duration || 0;
          } else {
            const start = finalStartTime.getTime();
            updateData.duration = Math.floor((end - start) / 1000);
          }

          if (updateData.duration < 0) {
            throw new BadRequestException(
              "Duration cannot be negative. Please check startTime and endTime values.",
            );
          }
          if (updateData.duration > 2147483647) {
            throw new BadRequestException(
              "Duration exceeds maximum allowed value (68+ years). Please check startTime and endTime values.",
            );
          }
        }

        const finalEndTimeCheck = updateData.endTime
          ? new Date(updateData.endTime)
          : new Date();
        if (finalEndTimeCheck <= finalStartTime) {
          throw new BadRequestException("End time must be after start time");
        }
      }

      // Проверяем проект в транзакции для предотвращения race condition
      if (dto.projectId !== undefined) {
        if (dto.projectId === null || dto.projectId === "") {
          // CRITICAL: For employees, project cannot be removed
          const entryUser = await tx.user.findFirst({
            where: {
              id: currentEntry.userId,
              companyId,
            },
            select: {
              role: true,
            },
          });

          if (entryUser?.role === UserRole.EMPLOYEE) {
            throw new BadRequestException(
              "Project is required for employees. Cannot remove project from time entry.",
            );
          }

          updateData.projectId = null;
        } else {
          const project = await tx.project.findFirst({
            where: {
              id: dto.projectId,
              companyId,
            },
          });

          if (!project) {
            throw new NotFoundException(
              `Project with ID ${dto.projectId} not found in your company`,
            );
          }

          if (project.status === "ARCHIVED") {
            throw new BadRequestException(
              "Cannot assign time entry to archived project",
            );
          }
        }
      }

      // Check for active entries if trying to set status to RUNNING
      // This check happens within the transaction AFTER reading current entry to prevent race conditions
      if (dto.status === "RUNNING" && currentEntry.status !== "RUNNING") {
        const activeEntryCheck = await tx.timeEntry.findFirst({
          where: {
            userId: currentEntry.userId,
            status: {
              in: ["RUNNING", "PAUSED"],
            },
            id: {
              not: id,
            },
            user: {
              companyId,
            },
          },
        });

        if (activeEntryCheck) {
          throw new BadRequestException(
            "User already has an active time entry. Please stop or pause the existing entry first.",
          );
        }
      }

      // Update entry immediately after checks to minimize race condition window
      return tx.timeEntry.update({
        where: { id },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });
    });

    await this.cache.invalidateStats(companyId);

    // Сбрасываем isIdle в false только если статус действительно RUNNING
    if (updated.status === "RUNNING") {
      try {
        await this.prisma.userActivity.updateMany({
          where: { userId: updated.userId },
          data: { isIdle: false },
        });
      } catch (error: unknown) {
        // Если не удалось обновить isIdle, логируем, но не критично
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const errorMessage = (error as any)?.message || String(error);
        this.logger.warn(
          { userId: updated.userId, error: errorMessage },
          "Failed to reset isIdle when resuming time entry",
        );
      }
    }

    // Обрабатываем ошибки broadcast (не критично, но логируем)
    try {
      this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { entryId: updated.id, error: errorMessage },
        "Failed to broadcast time entry update",
      );
    }

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate(
        { trigger: "time-entry-updated" },
        companyId,
      );
    }, 1000);

    return updated;
  }

  async stop(
    id: string,
    companyId: string,
    stopperId: string,
    stopperRole: UserRole,
  ) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Verify entry exists and belongs to company within transaction
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
      });

      if (!currentEntry) {
        throw new NotFoundException(`Time entry with ID ${id} not found`);
      }

      // Check permissions within transaction to prevent race conditions
      if (
        stopperRole !== UserRole.OWNER &&
        stopperRole !== UserRole.ADMIN &&
        stopperRole !== UserRole.SUPER_ADMIN
      ) {
        if (currentEntry.userId !== stopperId) {
          throw new ForbiddenException(
            "You can only stop your own time entries",
          );
        }
      }

      // Check status again within transaction
      if (currentEntry.status === "STOPPED") {
        throw new BadRequestException("Time entry is already stopped");
      }

      // Calculate endTime and duration within transaction using current entry data
      const endTime = new Date();

      // Пересчитываем duration на основе актуального статуса из транзакции
      let finalDuration = currentEntry.duration;
      if (currentEntry.status === "RUNNING") {
        const start = new Date(currentEntry.startTime).getTime();
        const end = endTime.getTime();
        const elapsed = Math.floor((end - start) / 1000);

        // Log warning if elapsed time is negative (possible clock sync issue)
        if (elapsed < 0) {
          this.logger.warn(
            {
              entryId: currentEntry.id,
              userId: currentEntry.userId,
              startTime: currentEntry.startTime,
              endTime: endTime.toISOString(),
              elapsed,
            },
            "Negative elapsed time detected in stop() - possible clock synchronization issue",
          );
        }

        const safeElapsed = Math.max(0, elapsed);
        finalDuration = currentEntry.duration + safeElapsed;
      } else if (currentEntry.status === "PAUSED") {
        finalDuration = currentEntry.duration;
      }

      if (finalDuration < 0) {
        throw new BadRequestException(
          "Duration cannot be negative. Please check time entry data.",
        );
      }

      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          endTime,
          duration: finalDuration,
          status: "STOPPED",
          approvalStatus: "PENDING",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const activity = await tx.activity.create({
        data: {
          userId: currentEntry.userId,
          projectId: currentEntry.projectId,
          type: "STOP",
        },
      });

      return {
        entry: updatedEntry,
        activityId: activity.id,
        activityTimestamp: activity.timestamp,
      };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    // Обрабатываем ошибки broadcast (не критично, но логируем)
    try {
      if (updated.user && updated.user.name) {
        this.eventsGateway.broadcastActivity(
          {
            id: activityId,
            userId: updated.userId,
            userName: updated.user.name,
            userAvatar: updated.user.avatar ?? undefined,
            type: "STOP",
            projectId: updated.projectId ?? undefined,
            timestamp: activityTimestamp.toISOString(),
          },
          companyId,
        );
      } else {
        this.logger.error(
          `Failed to broadcast activity ${activityId}: user data missing`,
          {
            entryId: updated.id,
            userId: updated.userId,
          },
        );
      }
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { activityId, entryId: updated.id, error: errorMessage },
        "Failed to broadcast activity",
      );
    }

    try {
      this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { entryId: updated.id, error: errorMessage },
        "Failed to broadcast time entry update",
      );
    }

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate(
        { trigger: "time-entry-updated" },
        companyId,
      );
    }, 1000);

    return updated;
  }

  async pause(
    id: string,
    companyId: string,
    pauserId: string,
    pauserRole: UserRole,
  ) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Verify entry exists and belongs to company within transaction
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
      });

      if (!currentEntry) {
        throw new NotFoundException(`Time entry with ID ${id} not found`);
      }

      // Check permissions within transaction to prevent race conditions
      if (
        pauserRole !== UserRole.OWNER &&
        pauserRole !== UserRole.ADMIN &&
        pauserRole !== UserRole.SUPER_ADMIN
      ) {
        if (currentEntry.userId !== pauserId) {
          throw new ForbiddenException(
            "You can only pause your own time entries",
          );
        }
      }

      // Check status again within transaction
      if (currentEntry.status !== "RUNNING") {
        throw new BadRequestException("Only running entries can be paused");
      }

      // Calculate elapsed time within transaction using current entry data
      const now = new Date();
      const start = new Date(currentEntry.startTime).getTime();
      const elapsed = Math.floor((now.getTime() - start) / 1000);

      // Log warning if elapsed time is negative (possible clock sync issue)
      if (elapsed < 0) {
        this.logger.warn(
          {
            entryId: currentEntry.id,
            userId: currentEntry.userId,
            startTime: currentEntry.startTime,
            now: now.toISOString(),
            elapsed,
          },
          "Negative elapsed time detected in pause() - possible clock synchronization issue",
        );
      }

      const safeElapsed = Math.max(0, elapsed);
      const newDuration = currentEntry.duration + safeElapsed;

      if (newDuration < 0) {
        throw new BadRequestException(
          "Calculated duration cannot be negative. Please check system clock synchronization.",
        );
      }

      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          duration: newDuration,
          status: "PAUSED",
          startTime: now,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const activity = await tx.activity.create({
        data: {
          userId: currentEntry.userId,
          projectId: currentEntry.projectId,
          type: "PAUSE",
        },
      });

      return {
        entry: updatedEntry,
        activityId: activity.id,
        activityTimestamp: activity.timestamp,
      };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    // Обрабатываем ошибки broadcast (не критично, но логируем)
    try {
      if (updated.user && updated.user.name) {
        this.eventsGateway.broadcastActivity(
          {
            id: activityId,
            userId: updated.userId,
            userName: updated.user.name,
            userAvatar: updated.user.avatar ?? undefined,
            type: "PAUSE",
            projectId: updated.projectId ?? undefined,
            timestamp: activityTimestamp.toISOString(),
          },
          companyId,
        );
      } else {
        this.logger.error(
          `Failed to broadcast activity ${activityId}: user data missing`,
          {
            entryId: updated.id,
            userId: updated.userId,
          },
        );
      }
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { activityId, entryId: updated.id, error: errorMessage },
        "Failed to broadcast activity",
      );
    }

    try {
      this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { entryId: updated.id, error: errorMessage },
        "Failed to broadcast time entry update",
      );
    }

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate(
        { trigger: "time-entry-updated" },
        companyId,
      );
    }, 1000);

    return updated;
  }

  async resume(
    id: string,
    companyId: string,
    resumerId: string,
    resumerRole: UserRole,
  ) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Use findFirst with companyId check to ensure data isolation
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
      });

      if (!currentEntry) {
        throw new NotFoundException(`Time entry with ID ${id} not found`);
      }

      // Check permissions within transaction to prevent race conditions
      if (
        resumerRole !== UserRole.OWNER &&
        resumerRole !== UserRole.ADMIN &&
        resumerRole !== UserRole.SUPER_ADMIN
      ) {
        if (currentEntry.userId !== resumerId) {
          throw new ForbiddenException(
            "You can only resume your own time entries",
          );
        }
      }

      if (currentEntry.status !== "PAUSED") {
        throw new BadRequestException("Only paused entries can be resumed");
      }

      // Check for active entries BEFORE updating to prevent race conditions
      // This check happens within the transaction to ensure consistency
      const activeEntryCheck = await tx.timeEntry.findFirst({
        where: {
          userId: currentEntry.userId,
          status: {
            in: ["RUNNING", "PAUSED"],
          },
          id: {
            not: id,
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntryCheck) {
        throw new BadRequestException(
          "User already has an active time entry. Please stop or pause the existing entry first.",
        );
      }

      // Update entry - this happens immediately after the check to minimize race condition window
      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          startTime: new Date(),
          status: "RUNNING",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const activity = await tx.activity.create({
        data: {
          userId: updatedEntry.userId,
          projectId: updatedEntry.projectId,
          type: "RESUME",
        },
      });

      return {
        entry: updatedEntry,
        activityId: activity.id,
        activityTimestamp: activity.timestamp,
      };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    // Обрабатываем ошибки broadcast (не критично, но логируем)
    try {
      if (updated.user && updated.user.name) {
        this.eventsGateway.broadcastActivity(
          {
            id: activityId,
            userId: updated.userId,
            userName: updated.user.name,
            userAvatar: updated.user.avatar ?? undefined,
            type: "RESUME",
            projectId: updated.projectId ?? undefined,
            timestamp: activityTimestamp.toISOString(),
          },
          companyId,
        );
      } else {
        this.logger.error(
          `Failed to broadcast activity ${activityId}: user data missing`,
          {
            entryId: updated.id,
            userId: updated.userId,
          },
        );
      }
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { activityId, entryId: updated.id, error: errorMessage },
        "Failed to broadcast activity",
      );
    }

    try {
      this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);
    } catch (error: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { entryId: updated.id, error: errorMessage },
        "Failed to broadcast time entry update",
      );
    }

    // Сбрасываем isIdle в false при возобновлении time entry
    try {
      await this.prisma.userActivity.updateMany({
        where: { userId: updated.userId },
        data: { isIdle: false },
      });
    } catch (error: unknown) {
      // Если не удалось обновить isIdle, логируем, но не критично
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const errorMessage = (error as any)?.message || String(error);
      this.logger.warn(
        { userId: updated.userId, error: errorMessage },
        "Failed to reset isIdle when resuming time entry",
      );
    }

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate(
        { trigger: "time-entry-updated" },
        companyId,
      );
    }, 1000);

    return updated;
  }

  async findAllActivities(
    companyId: string,
    userId?: string,
    limit: number = 100,
  ) {
    // Validate and constrain limit to prevent performance issues
    const validatedLimit = Math.min(Math.max(1, limit), 1000); // Between 1 and 1000

    const where: {
      user: { companyId: string };
      userId?: string;
      projectId?: string;
    } = {
      user: {
        companyId,
      },
    };

    if (userId) {
      // Validate that userId belongs to the same company to prevent data leakage
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          companyId,
        },
        select: { id: true },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${userId} not found in your company`,
        );
      }

      where.userId = userId;
    }

    const activities = await this.prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: validatedLimit,
    });

    return activities
      .filter((activity) => activity.user !== null)
      .map((activity) => ({
        id: activity.id,
        userId: activity.userId,
        userName: activity.user?.name || "Unknown User",
        userAvatar: activity.user?.avatar ?? undefined,
        type: activity.type.toLowerCase(),
        timestamp: activity.timestamp,
        projectId: activity.projectId ?? undefined,
      }));
  }

  async remove(
    id: string,
    companyId: string,
    deleterId: string,
    deleterRole: UserRole,
  ) {
    // Perform deletion within transaction to ensure atomicity and verify companyId
    const deleted = await this.prisma.$transaction(async (tx) => {
      // Verify entry exists and belongs to company within transaction
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
      });

      if (!currentEntry) {
        throw new NotFoundException(`Time entry with ID ${id} not found`);
      }

      // Check permissions
      if (
        deleterRole !== UserRole.OWNER &&
        deleterRole !== UserRole.ADMIN &&
        deleterRole !== UserRole.SUPER_ADMIN
      ) {
        if (currentEntry.userId !== deleterId) {
          throw new ForbiddenException(
            "You can only delete your own time entries",
          );
        }
      }

      return tx.timeEntry.delete({
        where: { id },
      });
    });

    await this.cache.invalidateStats(companyId);
    return deleted;
  }
}
