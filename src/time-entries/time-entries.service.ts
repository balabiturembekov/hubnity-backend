import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { EventsGateway } from '../events/events.gateway';
import { CreateTimeEntryDto } from './dto/create-time-entry.dto';
import { UpdateTimeEntryDto } from './dto/update-time-entry.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TimeEntriesService {
  private readonly logger = new Logger(TimeEntriesService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {}

  async create(dto: CreateTimeEntryDto, companyId: string, creatorId: string, creatorRole: UserRole) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found in your company`);
    }

    if (user.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot create time entry for inactive user');
    }

    // CRITICAL: For employees, project is required
    if (user.role === UserRole.EMPLOYEE && !dto.projectId) {
      throw new BadRequestException('Project is required for employees. Please select a project before starting the timer.');
    }

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: dto.projectId,
          companyId,
        },
      });

      if (!project) {
        throw new NotFoundException(`Project with ID ${dto.projectId} not found in your company`);
      }

      if (project.status === 'ARCHIVED') {
        throw new BadRequestException('Cannot create time entry for archived project');
      }
    }

    const startTime = dto.startTime ? new Date(dto.startTime) : new Date();
    const maxFutureTime = new Date();
    maxFutureTime.setHours(maxFutureTime.getHours() + 1);
    if (startTime > maxFutureTime) {
      throw new BadRequestException('Start time cannot be more than 1 hour in the future');
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const activeEntryCheck = await tx.timeEntry.findFirst({
        where: {
          userId: dto.userId,
          status: {
            in: ['RUNNING', 'PAUSED'],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntryCheck) {
        throw new BadRequestException('User already has an active time entry. Please stop or pause the existing entry first.');
      }

      const newEntry = await tx.timeEntry.create({
        data: {
          userId: dto.userId,
          projectId: dto.projectId,
          startTime,
          description: dto.description,
          status: dto.status || 'RUNNING',
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
          type: 'START',
        },
      });

      return { entry: newEntry, activityId: activity.id, activityTimestamp: activity.timestamp };
    });

    const entry = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    if (entry.user && entry.user.name) {
      this.eventsGateway.broadcastActivity(
        {
          id: activityId,
          userId: entry.userId,
          userName: entry.user.name,
          userAvatar: entry.user.avatar ?? undefined,
          type: 'START',
          projectId: entry.projectId ?? undefined,
          timestamp: activityTimestamp.toISOString(),
        },
        companyId,
      );
    } else {
      this.logger.error(`Failed to broadcast activity ${activityId}: user data missing`, {
        entryId: entry.id,
        userId: entry.userId,
      });
    }

    this.eventsGateway.broadcastTimeEntryUpdate(entry, companyId);

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-created' }, companyId);
    }, 1000);

    return entry;
  }

  async findAll(companyId: string, userId?: string, projectId?: string) {
    const where: any = {
      user: {
        companyId,
      },
    };

    if (userId) {
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
        throw new NotFoundException(`Project with ID ${projectId} not found in your company`);
      }

      where.projectId = projectId;
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
      orderBy: { startTime: 'desc' },
    });
  }

  async findActive(companyId: string, userId?: string) {
    const where: any = {
      status: {
        in: ['RUNNING', 'PAUSED'],
      },
      user: {
        companyId,
      },
    };

    if (userId) {
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

  async update(
    id: string,
    dto: UpdateTimeEntryDto,
    companyId: string,
    updaterId: string,
    updaterRole: UserRole,
  ) {
    const entry = await this.findOne(id, companyId);

    if (updaterRole !== UserRole.OWNER && updaterRole !== UserRole.ADMIN && updaterRole !== UserRole.SUPER_ADMIN) {
      if (entry.userId !== updaterId) {
        throw new ForbiddenException('You can only update your own time entries');
      }
    }

    const updateData: any = { ...dto };

    if (dto.projectId !== undefined) {
      if (dto.projectId === null || dto.projectId === '') {
        // CRITICAL: For employees, project cannot be removed
        const entryUser = await this.prisma.user.findFirst({
          where: {
            id: entry.userId,
            companyId,
          },
          select: {
            role: true,
          },
        });

        if (entryUser?.role === UserRole.EMPLOYEE) {
          throw new BadRequestException('Project is required for employees. Cannot remove project from time entry.');
        }

        updateData.projectId = null;
      } else {
        const project = await this.prisma.project.findFirst({
          where: {
            id: dto.projectId,
            companyId,
          },
        });

        if (!project) {
          throw new NotFoundException(`Project with ID ${dto.projectId} not found in your company`);
        }

        if (project.status === 'ARCHIVED') {
          throw new BadRequestException('Cannot assign time entry to archived project');
        }
      }
    }

    if (dto.endTime) {
      updateData.endTime = new Date(dto.endTime);
    }

    if (dto.startTime) {
      const newStartTime = new Date(dto.startTime);
      const maxFutureTime = new Date();
      maxFutureTime.setHours(maxFutureTime.getHours() + 1);
      if (newStartTime > maxFutureTime) {
        throw new BadRequestException('Start time cannot be more than 1 hour in the future');
      }
      updateData.startTime = newStartTime;
    }

    const finalStartTime = updateData.startTime ? new Date(updateData.startTime) : new Date(entry.startTime);
    const finalEndTime = updateData.endTime ? new Date(updateData.endTime) : null;

    if (finalEndTime && finalEndTime <= finalStartTime) {
      throw new BadRequestException('End time must be after start time');
    }

    if (dto.endTime && entry.status === 'RUNNING') {
      const start = finalStartTime.getTime();
      const end = finalEndTime!.getTime();
      const calculatedDuration = Math.floor((end - start) / 1000) + entry.duration;

      if (calculatedDuration < 0) {
        throw new BadRequestException('Calculated duration cannot be negative. Please check startTime and endTime values.');
      }

      updateData.duration = calculatedDuration;
      updateData.status = 'STOPPED';
    }

    if (dto.status === 'STOPPED' && entry.status !== 'STOPPED') {
      if (!dto.endTime) {
        updateData.endTime = new Date();
      }

      if (!dto.duration) {
        const end = updateData.endTime ? new Date(updateData.endTime).getTime() : new Date().getTime();

        if (entry.status === 'RUNNING') {
          const currentSessionStart = new Date(entry.startTime).getTime();
          const currentSessionSeconds = Math.floor((end - currentSessionStart) / 1000);
          updateData.duration = (entry.duration || 0) + currentSessionSeconds;
        } else if (entry.status === 'PAUSED') {
          updateData.duration = entry.duration || 0;
        } else {
          const start = finalStartTime.getTime();
          updateData.duration = Math.floor((end - start) / 1000);
        }

        if (updateData.duration < 0) {
          throw new BadRequestException('Duration cannot be negative. Please check startTime and endTime values.');
        }
        if (updateData.duration > 2147483647) {
          throw new BadRequestException('Duration exceeds maximum allowed value (68+ years). Please check startTime and endTime values.');
        }
      } else {
        if (dto.duration < 0) {
          throw new BadRequestException('Duration cannot be negative');
        }
        if (dto.duration > 2147483647) {
          throw new BadRequestException('Duration exceeds maximum allowed value (68+ years)');
        }
      }

      const finalEndTimeCheck = updateData.endTime ? new Date(updateData.endTime) : new Date();
      if (finalEndTimeCheck <= finalStartTime) {
        throw new BadRequestException('End time must be after start time');
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

      // Check for active entries if trying to set status to RUNNING
      // This check happens within the transaction AFTER reading current entry to prevent race conditions
      if (dto.status === 'RUNNING' && currentEntry.status !== 'RUNNING') {
        const activeEntryCheck = await tx.timeEntry.findFirst({
          where: {
            userId: currentEntry.userId,
            status: {
              in: ['RUNNING', 'PAUSED'],
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
          throw new BadRequestException('User already has an active time entry. Please stop or pause the existing entry first.');
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
    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-updated' }, companyId);
    }, 1000);

    return updated;
  }

  async stop(id: string, companyId: string, stopperId: string, stopperRole: UserRole) {
    const entry = await this.findOne(id, companyId);

    if (stopperRole !== UserRole.OWNER && stopperRole !== UserRole.ADMIN && stopperRole !== UserRole.SUPER_ADMIN) {
      if (entry.userId !== stopperId) {
        throw new ForbiddenException('You can only stop your own time entries');
      }
    }

    if (entry.status === 'STOPPED') {
      throw new BadRequestException('Time entry is already stopped');
    }

    const endTime = new Date();
    let duration = entry.duration;

    if (entry.status === 'RUNNING') {
      const start = new Date(entry.startTime).getTime();
      const end = endTime.getTime();
      const elapsed = Math.floor((end - start) / 1000);
      
      // Log warning if elapsed time is negative (possible clock sync issue)
      if (elapsed < 0) {
        this.logger.warn(
          {
            entryId: entry.id,
            userId: entry.userId,
            startTime: entry.startTime,
            endTime: endTime.toISOString(),
            elapsed,
          },
          'Negative elapsed time detected in stop() - possible clock synchronization issue',
        );
      }
      
      const safeElapsed = Math.max(0, elapsed);
      duration += safeElapsed;

      if (duration < 0) {
        throw new BadRequestException('Calculated duration cannot be negative. Please check system clock synchronization.');
      }
    } else if (entry.status === 'PAUSED') {
      duration = entry.duration;
      if (duration < 0) {
        throw new BadRequestException('Duration cannot be negative. Please check time entry data.');
      }
    }

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

      // Check status again within transaction
      if (currentEntry.status === 'STOPPED') {
        throw new BadRequestException('Time entry is already stopped');
      }

      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          endTime,
          duration,
          status: 'STOPPED',
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
          type: 'STOP',
        },
      });

      return { entry: updatedEntry, activityId: activity.id, activityTimestamp: activity.timestamp };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    if (updated.user && updated.user.name) {
      this.eventsGateway.broadcastActivity(
        {
          id: activityId,
          userId: updated.userId,
          userName: updated.user.name,
          userAvatar: updated.user.avatar ?? undefined,
          type: 'STOP',
          projectId: updated.projectId ?? undefined,
          timestamp: activityTimestamp.toISOString(),
        },
        companyId,
      );
    } else {
      this.logger.error(`Failed to broadcast activity ${activityId}: user data missing`, {
        entryId: updated.id,
        userId: updated.userId,
      });
    }

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-updated' }, companyId);
    }, 1000);

    return updated;
  }

  async pause(id: string, companyId: string, pauserId: string, pauserRole: UserRole) {
    const entry = await this.findOne(id, companyId);

    if (pauserRole !== UserRole.OWNER && pauserRole !== UserRole.ADMIN && pauserRole !== UserRole.SUPER_ADMIN) {
      if (entry.userId !== pauserId) {
        throw new ForbiddenException('You can only pause your own time entries');
      }
    }

    if (entry.status !== 'RUNNING') {
      throw new BadRequestException('Only running entries can be paused');
    }

    const now = new Date();
    const start = new Date(entry.startTime).getTime();
    const elapsed = Math.floor((now.getTime() - start) / 1000);
    
    // Log warning if elapsed time is negative (possible clock sync issue)
    if (elapsed < 0) {
      this.logger.warn(
        {
          entryId: entry.id,
          userId: entry.userId,
          startTime: entry.startTime,
          now: now.toISOString(),
          elapsed,
        },
        'Negative elapsed time detected in pause() - possible clock synchronization issue',
      );
    }
    
    const safeElapsed = Math.max(0, elapsed);
    const newDuration = entry.duration + safeElapsed;

    if (newDuration < 0) {
      throw new BadRequestException('Calculated duration cannot be negative. Please check system clock synchronization.');
    }

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

      // Check status again within transaction
      if (currentEntry.status !== 'RUNNING') {
        throw new BadRequestException('Only running entries can be paused');
      }

      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          duration: newDuration,
          status: 'PAUSED',
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
          type: 'PAUSE',
        },
      });

      return { entry: updatedEntry, activityId: activity.id, activityTimestamp: activity.timestamp };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    if (updated.user && updated.user.name) {
      this.eventsGateway.broadcastActivity(
        {
          id: activityId,
          userId: updated.userId,
          userName: updated.user.name,
          userAvatar: updated.user.avatar ?? undefined,
          type: 'PAUSE',
          projectId: updated.projectId ?? undefined,
          timestamp: activityTimestamp.toISOString(),
        },
        companyId,
      );
    } else {
      this.logger.error(`Failed to broadcast activity ${activityId}: user data missing`, {
        entryId: updated.id,
        userId: updated.userId,
      });
    }

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-updated' }, companyId);
    }, 1000);

    return updated;
  }

  async resume(id: string, companyId: string, resumerId: string, resumerRole: UserRole) {
    const entry = await this.findOne(id, companyId);

    if (resumerRole !== UserRole.OWNER && resumerRole !== UserRole.ADMIN && resumerRole !== UserRole.SUPER_ADMIN) {
      if (entry.userId !== resumerId) {
        throw new ForbiddenException('You can only resume your own time entries');
      }
    }

    if (entry.status !== 'PAUSED') {
      throw new BadRequestException('Only paused entries can be resumed');
    }

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // Use findFirst with companyId check to ensure data isolation
      const currentEntry = await tx.timeEntry.findFirst({
        where: {
          id,
          user: {
            companyId,
          },
        },
        select: { status: true, userId: true },
      });

      if (!currentEntry || currentEntry.status !== 'PAUSED') {
        throw new BadRequestException('Only paused entries can be resumed');
      }

      // Check for active entries BEFORE updating to prevent race conditions
      // This check happens within the transaction to ensure consistency
      const activeEntryCheck = await tx.timeEntry.findFirst({
        where: {
          userId: currentEntry.userId,
          status: {
            in: ['RUNNING', 'PAUSED'],
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
        throw new BadRequestException('User already has an active time entry. Please stop or pause the existing entry first.');
      }

      // Update entry - this happens immediately after the check to minimize race condition window
      const updatedEntry = await tx.timeEntry.update({
        where: { id },
        data: {
          startTime: new Date(),
          status: 'RUNNING',
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
          userId: entry.userId,
          projectId: entry.projectId,
          type: 'RESUME',
        },
      });

      return { entry: updatedEntry, activityId: activity.id, activityTimestamp: activity.timestamp };
    });

    const updated = transactionResult.entry;
    const activityId = transactionResult.activityId;
    const activityTimestamp = transactionResult.activityTimestamp;

    await this.cache.invalidateStats(companyId);

    if (updated.user && updated.user.name) {
      this.eventsGateway.broadcastActivity(
        {
          id: activityId,
          userId: updated.userId,
          userName: updated.user.name,
          userAvatar: updated.user.avatar ?? undefined,
          type: 'RESUME',
          projectId: updated.projectId ?? undefined,
          timestamp: activityTimestamp.toISOString(),
        },
        companyId,
      );
    } else {
      this.logger.error(`Failed to broadcast activity ${activityId}: user data missing`, {
        entryId: updated.id,
        userId: updated.userId,
      });
    }

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    setTimeout(() => {
      this.eventsGateway.broadcastStatsUpdate({ trigger: 'time-entry-updated' }, companyId);
    }, 1000);

    return updated;
  }

  async findAllActivities(companyId: string, userId?: string, limit: number = 100) {
    // Validate and constrain limit to prevent performance issues
    const validatedLimit = Math.min(Math.max(1, limit), 1000); // Between 1 and 1000

    const where: any = {
      user: {
        companyId,
      },
    };

    if (userId) {
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
        timestamp: 'desc',
      },
      take: validatedLimit,
    });

    return activities
      .filter((activity) => activity.user !== null)
      .map((activity) => ({
        id: activity.id,
        userId: activity.userId,
        userName: activity.user?.name || 'Unknown User',
        userAvatar: activity.user?.avatar ?? undefined,
        type: activity.type.toLowerCase(),
        timestamp: activity.timestamp,
        projectId: activity.projectId ?? undefined,
      }));
  }

  async remove(id: string, companyId: string, deleterId: string, deleterRole: UserRole) {
    // Initial check for existence and companyId
    const entry = await this.findOne(id, companyId);

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
      if (deleterRole !== UserRole.OWNER && deleterRole !== UserRole.ADMIN && deleterRole !== UserRole.SUPER_ADMIN) {
        if (currentEntry.userId !== deleterId) {
          throw new ForbiddenException('You can only delete your own time entries');
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

