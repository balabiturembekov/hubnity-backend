// time-entries/approval.service.ts
import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ApproveTimeEntryDto,
  LockPeriodDto,
  TimeEditLogDto,
} from "./dto/approval.dto";
import {
  PermissionDeniedException,
  EntityNotFoundException,
  InvalidOperationException,
} from "../exceptions/business.exception";

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== УТВЕРЖДЕНИЕ ====================

  /**
   * Утвердить записи времени (для менеджеров)
   */
  async approveTimeEntries(
    userId: string,
    dto: ApproveTimeEntryDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    this.logger.log(
      `User ${userId} approving ${dto.timeEntryIds.length} time entries`,
    );

    // 1. Проверяем, что все записи существуют и доступны
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: { id: { in: dto.timeEntryIds } },
      include: {
        project: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (timeEntries.length !== dto.timeEntryIds.length) {
      throw new EntityNotFoundException("Time entrie", "multiple");
    }

    // 2. Проверяем права (пользователь должен быть менеджером в организации)
    for (const entry of timeEntries) {
      await this.canApproveTimeEntry(userId, entry);
    }

    // 3. Проверяем, что записи не заблокированы
    const lockedEntries = timeEntries.filter((e) => e.locked);
    if (lockedEntries.length > 0) {
      throw new InvalidOperationException(
        `Cannot approve locked time entries: ${lockedEntries.map((e) => e.id).join(", ")}`,
      );
    }

    // 4. Обновляем статус
    const updated = await this.prisma.timeEntry.updateMany({
      where: { id: { in: dto.timeEntryIds } },
      data: {
        approved: dto.approved ?? true,
        approvedById: userId,
        approvedAt: new Date(),
      },
    });

    // 5. Логируем действие
    await this.prisma.timeEditLog.createMany({
      data: dto.timeEntryIds.map((id) => ({
        timeEntryId: id,
        userId,
        changedAt: new Date(),
        oldValues: { approved: false },
        newValues: { approved: true },
        ipAddress,
        userAgent,
      })),
    });

    this.logger.log(`Successfully approved ${updated.count} time entries`);

    return {
      message: "Time entries approved successfully",
      count: updated.count,
    };
  }

  /**
   * Проверка прав на утверждение
   */
  private async canApproveTimeEntry(
    userId: string,
    timeEntry: any,
  ): Promise<boolean> {
    // 1. Владелец организации
    if (timeEntry.project.organization.ownerId === userId) {
      return true;
    }

    // 2. Админ организации
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: timeEntry.project.organization.id,
          userId,
        },
      },
    });

    if (orgMember?.role === "ADMIN" || orgMember?.role === "MANAGER") {
      return true;
    }

    // 3. Менеджер проекта
    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: timeEntry.projectId,
          userId,
        },
      },
    });

    if (projectMember?.role === "ADMIN" || projectMember?.role === "MANAGER") {
      return true;
    }

    throw new PermissionDeniedException(
      "You are not allowed to approve these time entries",
    );
  }

  // ==================== БЛОКИРОВКА ПЕРИОДОВ ====================

  /**
   * Заблокировать период (например, прошлую неделю)
   */
  async lockPeriod(organizationId: string, userId: string, dto: LockPeriodDto) {
    this.logger.log(
      `Locking period ${dto.startDate} - ${dto.endDate} for org ${organizationId}`,
    );

    // 1. Проверяем права (только OWNER или ADMIN)
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (organization?.ownerId !== userId && member?.role !== "ADMIN") {
      throw new PermissionDeniedException(
        "Only owner or admin can lock periods",
      );
    }

    // 2. Создаем запись о блокировке
    const lockedPeriod = await this.prisma.lockedPeriod.create({
      data: {
        organizationId,
        startDate: dto.startDate,
        endDate: dto.endDate,
        reason: dto.reason,
        lockedById: userId,
        lockedAt: new Date(),
        isActive: true,
      },
    });

    // 3. Блокируем все записи в этом периоде
    await this.prisma.timeEntry.updateMany({
      where: {
        project: { organizationId },
        startTime: {
          gte: dto.startDate,
          lte: dto.endDate,
        },
        locked: false,
      },
      data: {
        locked: true,
        lockedAt: new Date(),
        lockedById: userId,
      },
    });

    return lockedPeriod;
  }

  /**
   * Разблокировать период
   */
  async unlockPeriod(periodId: string, userId: string, reason?: string) {
    this.logger.log(`Unlocking period ${periodId}`);

    const period = await this.prisma.lockedPeriod.findUnique({
      where: { id: periodId },
      include: { organization: true },
    });

    if (!period) {
      throw new EntityNotFoundException("LockedPeriod", periodId);
    }

    // Проверяем права
    if (period.organization.ownerId !== userId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: period.organizationId,
            userId,
          },
        },
      });
      if (member?.role !== "ADMIN") {
        throw new PermissionDeniedException(
          "Only owner or admin can unlock periods",
        );
      }
    }

    // Мягкое удаление блокировки
    await this.prisma.lockedPeriod.update({
      where: { id: periodId },
      data: {
        isActive: false,
        unlockedById: userId,
        unlockedAt: new Date(),
      },
    });

    // Разблокируем записи
    await this.prisma.timeEntry.updateMany({
      where: {
        project: { organizationId: period.organizationId },
        startTime: {
          gte: period.startDate,
          lte: period.endDate,
        },
        locked: true,
      },
      data: {
        locked: false,
        lockedAt: null,
        lockedById: null,
      },
    });

    return { message: "Period unlocked successfully" };
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Получить логи изменений для записи времени
   */
  async getTimeEntryLogs(
    timeEntryId: string,
    userId: string,
  ): Promise<TimeEditLogDto[]> {
    this.logger.log(`Fetching logs for time entry ${timeEntryId}`);

    // Проверяем доступ к записи
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
      include: {
        project: {
          include: { organization: true },
        },
      },
    });

    if (!timeEntry) {
      throw new EntityNotFoundException("TimeEntry", timeEntryId);
    }

    // Проверка прав
    const canView = await this.canViewLogs(userId, timeEntry);
    if (!canView) {
      throw new PermissionDeniedException(
        "You cannot view logs for this time entry",
      );
    }

    const logs = await this.prisma.timeEditLog.findMany({
      where: { timeEntryId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { changedAt: "desc" },
    });

    return logs;
  }

  /**
   * Логирование изменений (вызывать из сервиса при обновлении)
   */
  async logTimeEntryChange(
    timeEntryId: string,
    userId: string,
    oldValues: any,
    newValues: any,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.timeEditLog.create({
      data: {
        timeEntryId,
        userId,
        changedAt: new Date(),
        oldValues,
        newValues,
        reason,
        ipAddress,
        userAgent,
      },
    });
  }

  private async canViewLogs(userId: string, timeEntry: any): Promise<boolean> {
    // Сам пользователь
    if (timeEntry.userId === userId) return true;

    // Владелец организации
    if (timeEntry.project.organization.ownerId === userId) return true;

    // Админ/менеджер организации
    const orgMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: timeEntry.project.organization.id,
          userId,
        },
      },
    });

    if (orgMember?.role === "ADMIN" || orgMember?.role === "MANAGER") {
      return true;
    }

    // Менеджер проекта
    const projectMember = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: timeEntry.projectId,
          userId,
        },
      },
    });

    return projectMember?.role === "ADMIN" || projectMember?.role === "MANAGER";
  }
}
