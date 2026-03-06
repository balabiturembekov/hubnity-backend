import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  PayrollFilterDto,
  PayrollSummaryDto,
  PayrollItemDto,
  PayrollRunDto,
  PayrollRunResponseDto,
  PayrollPeriod,
  PayrollHistoryDto,
} from "./dto/payroll.dto";
import {
  EntityNotFoundException,
  PermissionDeniedException,
  InvalidOperationException,
} from "../exceptions/business.exception";

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);
  private activePayrollRuns: Map<string, PayrollRunResponseDto> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  // ==================== ОСНОВНЫЕ МЕТОДЫ ====================

  async calculatePayroll(
    userId: string,
    filter: PayrollFilterDto,
  ): Promise<PayrollSummaryDto> {
    this.logger.log(`Calculating payroll for user ${userId}`);

    // 1. Определяем период расчета
    const period = this.determinePeriod(filter);

    // 2. Получаем организацию
    const organization = await this.getOrganization(
      userId,
      filter.organizationId,
    );

    // 3. Получаем всех активных сотрудников организации
    const members = await this.getActiveMembers(organization.id, filter.userId);

    if (members.length === 0) {
      throw new InvalidOperationException(
        "No active members found for payroll calculation",
      );
    }

    // 4. Получаем time entries за период
    const timeEntries = await this.getTimeEntries(
      members.map((m) => m.userId),
      period.start,
      period.end,
    );

    // 5. Группируем по пользователям и считаем зарплату
    const items = await this.calculatePayrollItems(members, timeEntries);

    // 6. Считаем итоги
    const totals = this.calculateTotals(items);

    return {
      period: {
        start: period.start,
        end: period.end,
        name: this.getPeriodName(period),
      },
      items,
      totals,
      organizationId: organization.id,
      organizationName: organization.name,
      generatedAt: new Date(),
    };
  }

  /**
   * Запустить расчет зарплаты (асинхронно)
   */
  async runPayroll(
    userId: string,
    dto: PayrollRunDto,
  ): Promise<PayrollRunResponseDto> {
    this.logger.log(`Running payroll for organization ${dto.organizationId}`);

    // 1. Проверяем права
    await this.validatePayrollAccess(userId, dto.organizationId);

    // 2. Создаем запись о запуске
    const runId = `payroll_${Date.now()}_${dto.organizationId}`;
    const period = this.determinePeriod(dto);

    const run: PayrollRunResponseDto = {
      id: runId,
      status: "pending",
      organizationId: dto.organizationId,
      period: {
        start: period.start,
        end: period.end,
      },
      createdAt: new Date(),
    };

    this.activePayrollRuns.set(runId, run);

    // 3. Запускаем асинхронный расчет
    this.processPayrollRun(runId, userId, dto).catch((error) => {
      this.logger.error(`Payroll run ${runId} failed: ${error.message}`);
    });

    return run;
  }

  /**
   * Получить статус расчета зарплаты
   */
  async getPayrollStatus(runId: string): Promise<PayrollRunResponseDto> {
    const run = this.activePayrollRuns.get(runId);
    if (!run) {
      throw new EntityNotFoundException("Payroll run", runId);
    }
    return run;
  }

  /**
   * Получить историю расчетов
   */
  async getPayrollHistory(
    userId: string,
    organizationId: string,
  ): Promise<PayrollHistoryDto[]> {
    this.logger.log(`Fetching payroll history for org ${organizationId}`);

    await this.validatePayrollAccess(userId, organizationId);

    // TODO: Сохранять историю в БД
    // Пока возвращаем из active runs
    const runs = Array.from(this.activePayrollRuns.values())
      .filter((run) => run.organizationId === organizationId)
      .map((run) => ({
        id: run.id,
        runDate: run.createdAt,
        period: `${run.period.start.toISOString().split("T")[0]} - ${run.period.end.toISOString().split("T")[0]}`,
        totalEmployees: run.summary?.totals.employeeCount || 0,
        totalHours: run.summary?.totals.totalHours || 0,
        totalGross: run.summary?.totals.totalGross || 0,
        currency: "USD", // TODO: из организации
        status: run.status,
      }));

    return runs;
  }

  // ==================== ПРИВАТНЫЕ МЕТОДЫ ====================

  private determinePeriod(filter: PayrollFilterDto | PayrollRunDto): {
    start: Date;
    end: Date;
  } {
    if (filter.startDate && filter.endDate) {
      return {
        start: new Date(filter.startDate),
        end: new Date(filter.endDate),
      };
    }

    const now = new Date();
    let start: Date;
    let end: Date;

    if (filter.period === PayrollPeriod.WEEKLY) {
      // Неделя: с понедельника по воскресенье
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1; // корректировка для понедельника
      start = new Date(now);
      start.setDate(now.getDate() - diff);
      start.setHours(0, 0, 0, 0);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (filter.period === PayrollPeriod.BI_WEEKLY) {
      // Две недели
      start = new Date(now);
      start.setDate(now.getDate() - 13);
      start.setHours(0, 0, 0, 0);

      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else {
      // Месяц
      const year = filter.year || now.getFullYear();
      const month =
        filter.month !== undefined ? filter.month - 1 : now.getMonth();

      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    }

    return { start, end };
  }

  private getPeriodName(period: { start: Date; end: Date }): string {
    const startStr = period.start.toISOString().split("T")[0];
    const endStr = period.end.toISOString().split("T")[0];

    if (startStr === endStr) return startStr;
    return `${startStr} - ${endStr}`;
  }

  private async getOrganization(userId: string, organizationId?: string) {
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (!org) {
        throw new EntityNotFoundException("Organization", organizationId);
      }
      return org;
    }

    // Если организация не указана, берем первую, где пользователь админ
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        role: { in: ["OWNER", "ADMIN"] },
        status: "ACTIVE",
      },
      include: {
        organization: true,
      },
    });

    if (!membership) {
      throw new PermissionDeniedException(
        "You need to be an admin to run payroll without specifying organization",
      );
    }

    return membership.organization;
  }

  private async getActiveMembers(
    organizationId: string,
    specificUserId?: string,
  ) {
    const where: any = {
      organizationId,
      status: "ACTIVE",
      is_current: true,
    };

    if (specificUserId) {
      where.userId = specificUserId;
    }

    const members = await this.prisma.organizationMember.findMany({
      where,
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
    });

    return members;
  }

  private async getTimeEntries(
    userIds: string[],
    startDate: Date,
    endDate: Date,
  ) {
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: userIds },
        startTime: { gte: startDate },
        endTime: { lte: endDate },
        approved: true, // Только утвержденные часы!
      },
      select: {
        id: true,
        userId: true,
        duration: true,
      },
    });

    return entries;
  }

  private async calculatePayrollItems(
    members: any[],
    timeEntries: any[],
  ): Promise<PayrollItemDto[]> {
    const items: PayrollItemDto[] = [];

    for (const member of members) {
      const userEntries = timeEntries.filter((e) => e.userId === member.userId);
      const totalSeconds = userEntries.reduce(
        (sum, e) => sum + (e.duration || 0),
        0,
      );
      const totalHours = totalSeconds / 3600;
      const hourlyRate = member.hourlyRate || 0;
      const grossPay = totalHours * hourlyRate;

      items.push({
        userId: member.user.id,
        userName: `${member.user.firstName} ${member.user.lastName}`,
        totalSeconds,
        totalHours,
        hourlyRate,
        currency: "USD", // TODO: из организации
        grossPay,
        netPay: grossPay, // Пока без вычетов
        timeEntriesCount: userEntries.length,
        timeEntryIds: userEntries.map((e) => e.id),
      });
    }

    return items;
  }

  private calculateTotals(items: PayrollItemDto[]) {
    return {
      totalHours: items.reduce((sum, i) => sum + i.totalHours, 0),
      totalGross: items.reduce((sum, i) => sum + i.grossPay, 0),
      totalNet: items.reduce((sum, i) => sum + i.netPay, 0),
      employeeCount: items.length,
    };
  }

  private async validatePayrollAccess(userId: string, organizationId: string) {
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

    const isOwner = organization?.ownerId === userId;
    const isAdmin = member?.role === "ADMIN";

    if (!isOwner && !isAdmin) {
      throw new PermissionDeniedException(
        "Only owner and admin can run payroll",
      );
    }
  }

  private async processPayrollRun(
    runId: string,
    userId: string,
    dto: PayrollRunDto,
  ) {
    // Обновляем статус на processing
    const run = this.activePayrollRuns.get(runId);
    if (run) {
      run.status = "processing";
      this.activePayrollRuns.set(runId, run);
    }

    try {
      // Рассчитываем payroll
      const summary = await this.calculatePayroll(userId, dto);

      // Обновляем результат
      if (run) {
        run.status = "completed";
        run.summary = summary;
        run.completedAt = new Date();
        this.activePayrollRuns.set(runId, run);
      }

      // TODO: Сохранить в БД историю
      this.logger.log(`Payroll run ${runId} completed successfully`);
    } catch (error) {
      if (run) {
        run.status = "failed";
        run.error = error.message;
        this.activePayrollRuns.set(runId, run);
      }
      this.logger.error(`Payroll run ${runId} failed: ${error.message}`);
    }
  }
}
