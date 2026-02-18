import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TimeEntriesActionService } from "./time-entries-action.service";
import { TimeEntriesApprovalService } from "./time-entries-approval.service";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { SyncTimeEntriesDto } from "./dto/sync-time-entry.dto";
import { UserRole } from "@prisma/client";

/**
 * Facade for TimeEntries. Delegates lifecycle actions to ActionService,
 * approval actions to ApprovalService. Keeps read-only queries (findAll, findOne, etc.).
 */
@Injectable()
export class TimeEntriesService {
  constructor(
    private prisma: PrismaService,
    private actionService: TimeEntriesActionService,
    private approvalService: TimeEntriesApprovalService,
  ) {}

  // ─── Lifecycle (delegate to ActionService) ─────────────────────────────────
  create(
    dto: CreateTimeEntryDto,
    companyId: string,
    creatorId: string,
    creatorRole: UserRole,
  ) {
    return this.actionService.create(dto, companyId, creatorId, creatorRole);
  }

  sync(
    dto: SyncTimeEntriesDto,
    companyId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    return this.actionService.sync(dto, companyId, actorId, actorRole);
  }

  update(
    id: string,
    dto: UpdateTimeEntryDto,
    companyId: string,
    updaterId: string,
    updaterRole: UserRole,
  ) {
    return this.actionService.update(id, dto, companyId, updaterId, updaterRole);
  }

  stop(id: string, companyId: string, stopperId: string, stopperRole: UserRole) {
    return this.actionService.stop(id, companyId, stopperId, stopperRole);
  }

  pause(
    id: string,
    companyId: string,
    pauserId: string,
    pauserRole: UserRole,
  ) {
    return this.actionService.pause(id, companyId, pauserId, pauserRole);
  }

  resume(
    id: string,
    companyId: string,
    resumerId: string,
    resumerRole: UserRole,
  ) {
    return this.actionService.resume(id, companyId, resumerId, resumerRole);
  }

  remove(
    id: string,
    companyId: string,
    deleterId: string,
    deleterRole: UserRole,
  ) {
    return this.actionService.remove(id, companyId, deleterId, deleterRole);
  }

  // ─── Approval (delegate to ApprovalService) ───────────────────────────────
  findPending(companyId: string, userId?: string, limit: number = 100) {
    return this.approvalService.findPending(companyId, userId, limit);
  }

  approve(entryId: string, companyId: string, approverId: string) {
    return this.approvalService.approve(entryId, companyId, approverId);
  }

  reject(
    entryId: string,
    companyId: string,
    approverId: string,
    rejectionComment?: string,
  ) {
    return this.approvalService.reject(
      entryId,
      companyId,
      approverId,
      rejectionComment,
    );
  }

  bulkApprove(ids: string[], companyId: string, approverId: string) {
    return this.approvalService.bulkApprove(ids, companyId, approverId);
  }

  bulkReject(
    ids: string[],
    companyId: string,
    approverId: string,
    rejectionComment?: string,
  ) {
    return this.approvalService.bulkReject(
      ids,
      companyId,
      approverId,
      rejectionComment,
    );
  }

  // ─── Read-only (kept in facade) ───────────────────────────────────────────
  async findAll(
    companyId: string,
    userId?: string,
    projectId?: string,
    limit: number = 100,
    startDate?: Date,
    endDate?: Date,
  ) {
    const where: {
      user: { companyId: string };
      userId?: string;
      projectId?: string;
      startTime?: { gte?: Date; lte?: Date };
    } = {
      user: {
        companyId,
      },
    };

    if (userId) {
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

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = startDate;
      if (endDate) where.startTime.lte = endDate;
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

  /**
   * Hubstaff-style paginated list: returns { time_entries, pagination: { next_page_start_id } }
   */
  async findAllPaginated(
    companyId: string,
    pageLimit: number = 100,
    pageStartId?: string,
    userId?: string,
    projectId?: string,
    timeSlotStart?: Date,
    timeSlotStop?: Date,
  ) {
    const where: {
      user: { companyId: string };
      userId?: string;
      projectId?: string;
      startTime?: { gte?: Date; lt?: Date };
    } = {
      user: {
        companyId,
      },
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

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, companyId },
      });
      if (!project) {
        throw new NotFoundException(
          `Project with ID ${projectId} not found in your company`,
        );
      }
      where.projectId = projectId;
    }

    if (timeSlotStart || timeSlotStop) {
      where.startTime = {};
      if (timeSlotStart) where.startTime.gte = timeSlotStart;
      if (timeSlotStop) where.startTime.lt = timeSlotStop;
    }

    const limit = Math.min(Math.max(1, pageLimit), 500);
    const cursor = pageStartId ? { id: pageStartId } : undefined;

    const entries = await this.prisma.timeEntry.findMany({
      where,
      take: limit + 1,
      skip: cursor ? 1 : 0,
      cursor,
      orderBy: { startTime: "desc" },
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

    const hasMore = entries.length > limit;
    const timeEntries = hasMore ? entries.slice(0, limit) : entries;
    const nextPageStartId = hasMore
      ? timeEntries[timeEntries.length - 1]?.id
      : undefined;

    return {
      time_entries: timeEntries,
      pagination: {
        next_page_start_id: nextPageStartId,
      },
    };
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

  async findAllActivities(
    companyId: string,
    userId?: string,
    limit: number = 100,
  ) {
    const validatedLimit = Math.min(Math.max(1, limit), 1000);

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

    const activities = await this.prisma.activity.findMany({
      where,
      take: validatedLimit,
      orderBy: { timestamp: "desc" },
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

    return activities.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.projectId ?? undefined,
      type: a.type,
      timestamp: a.timestamp,
      user: a.user,
      project: a.project,
    }));
  }

  async findActivitiesByTimeSlot(
    companyId: string,
    timeSlotStart: Date,
    timeSlotStop: Date,
    userIds?: string | string[],
    projectId?: string,
    limit: number = 100,
  ) {
    const validatedLimit = Math.min(Math.max(1, limit), 500);

    const where: {
      user: { companyId: string };
      userId?: string | { in: string[] };
      projectId?: string;
      timestamp: { gte: Date; lte: Date };
    } = {
      user: { companyId },
      timestamp: { gte: timeSlotStart, lte: timeSlotStop },
    };

    if (userIds) {
      const ids = Array.isArray(userIds) ? userIds : [userIds];
      if (ids.length > 0) {
        const users = await this.prisma.user.findMany({
          where: { id: { in: ids }, companyId },
          select: { id: true },
        });
        const foundIds = users.map((u) => u.id);
        const missing = ids.filter((id) => !foundIds.includes(id));
        if (missing.length > 0) {
          throw new NotFoundException(
            `User(s) with ID(s) ${missing.join(", ")} not found in your company`,
          );
        }
        where.userId = ids.length === 1 ? ids[0] : { in: ids };
      }
    }

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, companyId },
      });
      if (!project) {
        throw new NotFoundException(
          `Project with ID ${projectId} not found in your company`,
        );
      }
      where.projectId = projectId;
    }

    const activities = await this.prisma.activity.findMany({
      where,
      take: validatedLimit,
      orderBy: { timestamp: "desc" },
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

    return activities.map((a) => ({
      id: a.id,
      userId: a.userId,
      projectId: a.projectId ?? undefined,
      type: a.type,
      timestamp: a.timestamp,
      user: a.user,
      project: a.project,
    }));
  }
}
