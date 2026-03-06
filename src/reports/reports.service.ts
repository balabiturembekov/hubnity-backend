// reports/reports.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  TimecardFilterDto,
  TimecardGroupBy,
  TimecardResponseDto,
  TimecardEntryDto,
} from "./dto/timecard.dto";
import {
  BudgetFilterDto,
  ProjectBudgetReportDto,
  BudgetSummaryDto,
} from "./dto/budget.dto";
import {
  PermissionDeniedException,
  EntityNotFoundException,
} from "../exceptions/business.exception";

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== TIMECARDS ====================

  async getTimecards(
    userId: string,
    filter: TimecardFilterDto,
  ): Promise<TimecardResponseDto> {
    this.logger.log(`Generating timecards for user ${userId}`);

    // Проверяем права (пользователь может смотреть только свои или админ все)
    if (filter.userId && filter.userId !== userId) {
      // TODO: проверить, является ли пользователь админом
      const isAdmin = await this.checkIfAdmin(userId, filter.userId);
      if (!isAdmin) {
        throw new PermissionDeniedException(
          "You can only view your own timecards",
        );
      }
    }

    const targetUserId = filter.userId || userId;

    // Строим where условие
    const where: any = {
      userId: targetUserId,
    };

    if (filter.startDate || filter.endDate) {
      where.startTime = {};
      if (filter.startDate) {
        where.startTime.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.startTime.lte = filter.endDate;
      }
    }

    if (filter.projectId) {
      where.projectId = filter.projectId;
    }

    // Получаем все записи времени
    const timeEntries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    // Группируем по периоду
    const grouped = this.groupTimeEntries(
      timeEntries,
      filter.groupBy || TimecardGroupBy.DAY,
    );

    // Считаем итоги
    const summary = this.calculateSummary(grouped);

    return {
      entries: grouped,
      summary,
    };
  }

  private groupTimeEntries(
    entries: any[],
    groupBy: TimecardGroupBy,
  ): TimecardEntryDto[] {
    const groups = new Map<string, TimecardEntryDto>();

    for (const entry of entries) {
      let periodKey: string;

      switch (groupBy) {
        case TimecardGroupBy.DAY:
          periodKey = entry.startTime.toISOString().split("T")[0];
          break;
        case TimecardGroupBy.WEEK:
          periodKey = this.getWeekKey(entry.startTime);
          break;
        case TimecardGroupBy.MONTH:
          periodKey = `${entry.startTime.getFullYear()}-${String(entry.startTime.getMonth() + 1).padStart(2, "0")}`;
          break;
      }

      const duration = entry.duration || 0;
      const billable = entry.billable ? duration : 0;

      if (!groups.has(periodKey)) {
        groups.set(periodKey, {
          period: periodKey,
          totalSeconds: 0,
          totalHours: 0,
          billableSeconds: 0,
          billableHours: 0,
          projectId: entry.projectId,
          projectName: entry.project?.name,
        });
      }

      const group = groups.get(periodKey)!;
      group.totalSeconds += duration;
      group.totalHours += duration / 3600;
      group.billableSeconds += billable;
      group.billableHours += billable / 3600;
    }

    return Array.from(groups.values());
  }

  private getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay()); // Воскресенье = начало недели
    const year = d.getFullYear();
    const week = Math.ceil(
      (d.getTime() - new Date(year, 0, 1).getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  private calculateSummary(entries: TimecardEntryDto[]): any {
    const totalSeconds = entries.reduce((sum, e) => sum + e.totalSeconds, 0);
    const billableSeconds = entries.reduce(
      (sum, e) => sum + e.billableSeconds,
      0,
    );
    const avgPerDay = entries.length > 0 ? totalSeconds / entries.length : 0;

    return {
      totalSeconds,
      totalHours: totalSeconds / 3600,
      billableSeconds,
      billableHours: billableSeconds / 3600,
      averagePerDay: avgPerDay,
      averagePerDayHours: avgPerDay / 3600,
    };
  }

  // ==================== PROJECT BUDGETING ====================

  async getProjectBudgets(
    userId: string,
    filter: BudgetFilterDto,
  ): Promise<BudgetSummaryDto> {
    this.logger.log(`Generating budget report for user ${userId}`);

    // Определяем, какие проекты показывать
    let projects: any[] = [];

    if (filter.projectId) {
      // Один конкретный проект
      const project = await this.prisma.project.findUnique({
        where: { id: filter.projectId },
        include: {
          organization: true,
          budgets: true,
          timeEntries: {
            where: {
              endTime: { not: null },
            },
          },
        },
      });

      if (!project) {
        throw new EntityNotFoundException("Project", filter.projectId);
      }

      // Проверяем доступ
      await this.validateProjectAccess(project, userId);

      projects = [project];
    } else if (filter.organizationId) {
      // Все проекты организации
      const organization = await this.prisma.organization.findUnique({
        where: { id: filter.organizationId },
      });

      if (!organization) {
        throw new EntityNotFoundException(
          "Organization",
          filter.organizationId,
        );
      }

      // Проверяем доступ к организации
      await this.validateOrganizationAccess(filter.organizationId, userId);

      projects = await this.prisma.project.findMany({
        where: { organizationId: filter.organizationId },
        include: {
          budgets: true,
          timeEntries: {
            where: {
              endTime: { not: null },
            },
          },
        },
      });
    } else {
      // Все проекты, к которым есть доступ
      // Сначала находим организации, где пользователь участник
      const memberships = await this.prisma.organizationMember.findMany({
        where: { userId, status: "ACTIVE" },
        select: { organizationId: true },
      });

      const orgIds = memberships.map((m) => m.organizationId);

      projects = await this.prisma.project.findMany({
        where: { organizationId: { in: orgIds } },
        include: {
          organization: true,
          budgets: true,
          timeEntries: {
            where: {
              endTime: { not: null },
            },
          },
        },
      });
    }

    // Рассчитываем бюджеты для каждого проекта
    const projectReports: ProjectBudgetReportDto[] = projects.map((project) =>
      this.calculateProjectBudget(project),
    );

    // Считаем общую статистику
    const totalHoursSpent = projectReports.reduce(
      (sum, p) => sum + p.hoursSpent,
      0,
    );
    const totalBudgetedHours = projectReports.reduce(
      (sum, p) => sum + (p.hoursLimit || 0),
      0,
    );
    const projectsAtRisk = projectReports.filter(
      (p) => p.status === "WARNING",
    ).length;
    const projectsOverBudget = projectReports.filter(
      (p) => p.status === "OVER",
    ).length;

    return {
      projects: projectReports,
      organizationTotal: {
        projectsCount: projects.length,
        projectsAtRisk,
        projectsOverBudget,
        totalHoursSpent,
        totalBudgetedHours: totalBudgetedHours || null,
      },
    };
  }

  private calculateProjectBudget(project: any): ProjectBudgetReportDto {
    const budget = project.budgets?.[0] || null;

    // Суммируем все время
    const hoursSpent = project.timeEntries.reduce(
      (sum: number, entry: any) => sum + (entry.duration || 0) / 3600,
      0,
    );

    let hoursLimit = null;
    let hoursRemaining = null;
    let hoursPercentage = 0;
    let status: "OK" | "WARNING" | "OVER" = "OK";

    if (budget) {
      hoursLimit = budget.hoursLimit || null;

      if (hoursLimit) {
        hoursRemaining = Math.max(0, hoursLimit - hoursSpent);
        hoursPercentage = (hoursSpent / hoursLimit) * 100;

        if (hoursPercentage >= 100) {
          status = "OVER";
        } else if (hoursPercentage >= budget.notificationThreshold) {
          status = "WARNING";
        }
      }
    }

    // Определяем период для бюджета
    let periodStart = null;
    let periodEnd = null;

    if (budget) {
      if (budget.startDate) periodStart = budget.startDate;
      if (budget.endDate) periodEnd = budget.endDate;

      if (!periodStart && !periodEnd) {
        // Для MONTHLY/WEEKLY рассчитываем период
        const now = new Date();
        if (budget.budgetType === "MONTHLY") {
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        } else if (budget.budgetType === "WEEKLY") {
          const day = now.getDay();
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() - day);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
        }
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      budgetType: budget?.budgetType || "NONE",
      hoursLimit,
      costLimit: budget?.costLimit || null,
      hoursSpent,
      hoursRemaining,
      hoursPercentage,
      status,
      timeEntriesCount: project.timeEntries.length,
      period: {
        start: periodStart,
        end: periodEnd,
      },
    };
  }

  // ==================== PRIVATE HELPERS ====================

  private async checkIfAdmin(
    userId: string,
    targetUserId: string,
  ): Promise<boolean> {
    // Проверяем, является ли пользователь админом в какой-либо организации targetUserId
    const adminMemberships = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        role: { in: ["OWNER", "ADMIN"] },
        status: "ACTIVE",
      },
      select: { organizationId: true },
    });

    if (adminMemberships.length === 0) return false;

    const orgIds = adminMemberships.map((m) => m.organizationId);

    const targetMembership = await this.prisma.organizationMember.findFirst({
      where: {
        userId: targetUserId,
        organizationId: { in: orgIds },
      },
    });

    return !!targetMembership;
  }

  private async validateProjectAccess(
    project: any,
    userId: string,
  ): Promise<void> {
    // Проверяем доступ к проекту
    const isOwner = project.organization?.ownerId === userId;

    if (isOwner) return;

    const member = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId,
        },
      },
    });

    if (!member) {
      throw new PermissionDeniedException(
        "You do not have access to this project",
      );
    }
  }

  private async validateOrganizationAccess(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!member || member.status !== "ACTIVE") {
      throw new PermissionDeniedException(
        "You do not have access to this organization",
      );
    }
  }
}
