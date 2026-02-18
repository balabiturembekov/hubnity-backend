import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class TimeEntriesApprovalService {
  private readonly logger = new Logger(TimeEntriesApprovalService.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private notificationsService: NotificationsService,
  ) {}

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

    if (entry.userId === approverId) {
      throw new ForbiddenException(
        "You cannot approve your own time entries. Another approver is required.",
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
        approvedByUser: {
          select: { name: true },
        },
      },
    });

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    try {
      await this.notificationsService.create({
        userId: entry.userId,
        companyId,
        type: "TIME_ENTRY_APPROVED",
        title: "Запись времени одобрена",
        message: `Ваша запись времени${updated.project ? ` по проекту "${updated.project.name}"` : ""} была одобрена.`,
        metadata: {
          timeEntryId: entryId,
          actorId: approverId,
          actorName: (updated as { approvedByUser?: { name: string } })
            .approvedByUser?.name,
          projectId: updated.projectId ?? undefined,
          projectName: updated.project?.name,
        },
      });
    } catch (err) {
      this.logger.warn(
        { err, entryId, userId: entry.userId },
        "Failed to create approval notification",
      );
    }

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

    if (entry.userId === approverId) {
      throw new ForbiddenException(
        "You cannot reject your own time entries. Another approver is required.",
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
        approvedByUser: {
          select: { name: true },
        },
      },
    });

    this.eventsGateway.broadcastTimeEntryUpdate(updated, companyId);

    try {
      await this.notificationsService.create({
        userId: entry.userId,
        companyId,
        type: "TIME_ENTRY_REJECTED",
        title: "Запись времени отклонена",
        message: rejectionComment
          ? `Ваша запись времени${updated.project ? ` по проекту "${updated.project.name}"` : ""} была отклонена: ${rejectionComment}`
          : `Ваша запись времени${updated.project ? ` по проекту "${updated.project.name}"` : ""} была отклонена.`,
        metadata: {
          timeEntryId: entryId,
          actorId: approverId,
          actorName: (updated as { approvedByUser?: { name: string } })
            .approvedByUser?.name,
          projectId: updated.projectId ?? undefined,
          projectName: updated.project?.name,
          rejectionComment: rejectionComment ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(
        { err, entryId, userId: entry.userId },
        "Failed to create rejection notification",
      );
    }

    return updated;
  }

  async bulkApprove(ids: string[], companyId: string, approverId: string) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        id: { in: ids },
        user: { companyId },
        approvalStatus: "PENDING",
      },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const selfEntry = entries.find((e) => e.userId === approverId);
    if (selfEntry) {
      throw new ForbiddenException(
        "You cannot approve your own time entries. Another approver is required.",
      );
    }

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

    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true },
    });

    for (const entry of entries) {
      try {
        await this.notificationsService.create({
          userId: entry.userId,
          companyId,
          type: "TIME_ENTRY_APPROVED",
          title: "Запись времени одобрена",
          message: `Ваша запись времени${entry.project ? ` по проекту "${entry.project.name}"` : ""} была одобрена.`,
          metadata: {
            timeEntryId: entry.id,
            actorId: approverId,
            actorName: approver?.name,
            projectId: entry.projectId ?? undefined,
            projectName: entry.project?.name,
          },
        });
      } catch (err) {
        this.logger.warn(
          { err, entryId: entry.id, userId: entry.userId },
          "Failed to create bulk approval notification",
        );
      }
    }

    this.eventsGateway.broadcastStatsUpdate({ companyId }, companyId);
    return { approvedCount: result.count };
  }

  async bulkReject(
    ids: string[],
    companyId: string,
    approverId: string,
    rejectionComment?: string,
  ) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        id: { in: ids },
        user: { companyId },
        approvalStatus: "PENDING",
      },
      include: {
        user: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
    });

    const selfEntry = entries.find((e) => e.userId === approverId);
    if (selfEntry) {
      throw new ForbiddenException(
        "You cannot reject your own time entries. Another approver is required.",
      );
    }

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

    const approver = await this.prisma.user.findUnique({
      where: { id: approverId },
      select: { name: true },
    });

    for (const entry of entries) {
      try {
        await this.notificationsService.create({
          userId: entry.userId,
          companyId,
          type: "TIME_ENTRY_REJECTED",
          title: "Запись времени отклонена",
          message: rejectionComment
            ? `Ваша запись времени${entry.project ? ` по проекту "${entry.project.name}"` : ""} была отклонена: ${rejectionComment}`
            : `Ваша запись времени${entry.project ? ` по проекту "${entry.project.name}"` : ""} была отклонена.`,
          metadata: {
            timeEntryId: entry.id,
            actorId: approverId,
            actorName: approver?.name,
            projectId: entry.projectId ?? undefined,
            projectName: entry.project?.name,
            rejectionComment: rejectionComment ?? undefined,
          },
        });
      } catch (err) {
        this.logger.warn(
          { err, entryId: entry.id, userId: entry.userId },
          "Failed to create bulk rejection notification",
        );
      }
    }

    this.eventsGateway.broadcastStatsUpdate({ companyId }, companyId);
    return { rejectedCount: result.count };
  }
}
