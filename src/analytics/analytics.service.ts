import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  AnalyticsQueryDto,
  AnalyticsPeriod,
} from "./dto/analytics-query.dto";
import { Prisma } from "@prisma/client";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  getDateRange(
    period: AnalyticsPeriod,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === AnalyticsPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        period = AnalyticsPeriod.LAST_30_DAYS;
      } else {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        if (start < end) return { start, end };
        period = AnalyticsPeriod.LAST_30_DAYS;
      }
    }

    switch (period) {
      case AnalyticsPeriod.TODAY:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.YESTERDAY:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.LAST_7_DAYS:
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.LAST_30_DAYS:
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.LAST_90_DAYS:
        start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.THIS_MONTH:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.LAST_MONTH:
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case AnalyticsPeriod.THIS_YEAR:
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      default:
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }
    return { start, end };
  }

  private async validateAndGetWhere(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const isEmployee = userRole === "EMPLOYEE";
    if (isEmployee && query.userId && query.userId !== userId) {
      throw new ForbiddenException(
        "Employees can only view their own analytics",
      );
    }
    const effectiveUserId = isEmployee ? userId : query.userId;

    if (effectiveUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: effectiveUserId, companyId, status: "ACTIVE" },
      });
      if (!user) {
        throw new NotFoundException("User not found");
      }
    }

    if (query.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: query.projectId, companyId },
      });
      if (!project) {
        throw new NotFoundException("Project not found");
      }
    }

    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.LAST_30_DAYS,
      query.startDate,
      query.endDate,
    );

    const baseWhere: Prisma.TimeEntryWhereInput = {
      user: { companyId },
      status: "STOPPED",
      startTime: { gte: start, lte: end },
    };

    if (effectiveUserId) baseWhere.userId = effectiveUserId;
    if (query.projectId) baseWhere.projectId = query.projectId;

    return { where: baseWhere, start, end };
  }

  async getDashboard(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { where, start, end } = await this.validateAndGetWhere(
      companyId,
      userId,
      userRole,
      query,
    );

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        duration: true,
        userId: true,
        projectId: true,
        user: { select: { hourlyRate: true } },
      },
      take: 10000,
    });

    const totalSeconds = entries.reduce((sum, e) => sum + (e.duration || 0), 0);
    const totalHours = totalSeconds / 3600;
    const totalEarned = entries.reduce((sum, e) => {
      const hours = (e.duration || 0) / 3600;
      const rate = e.user?.hourlyRate ?? 0;
      return sum + hours * rate;
    }, 0);

    const uniqueUsers = new Set(entries.map((e) => e.userId)).size;
    const uniqueProjects = new Set(
      entries.map((e) => e.projectId).filter(Boolean),
    ).size;

    return {
      period: { startDate: start, endDate: end },
      totalHours: Math.round(totalHours * 100) / 100,
      totalEarned: Math.round(totalEarned * 100) / 100,
      entriesCount: entries.length,
      activeUsersCount: uniqueUsers,
      activeProjectsCount: uniqueProjects,
    };
  }

  async getHoursByDay(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { where, start, end } = await this.validateAndGetWhere(
      companyId,
      userId,
      userRole,
      query,
    );

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: { startTime: true, duration: true },
      take: 10000,
    });

    const byDay = new Map<string, number>();
    const current = new Date(start);
    while (current <= end) {
      const key = current.toISOString().split("T")[0];
      byDay.set(key, 0);
      current.setDate(current.getDate() + 1);
    }

    entries.forEach((e) => {
      const date = new Date(e.startTime);
      const key = date.toISOString().split("T")[0];
      if (byDay.has(key)) {
        byDay.set(key, byDay.get(key)! + (e.duration || 0) / 3600);
      }
    });

    const result = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => ({ date, hours: Math.round(hours * 100) / 100 }));

    return {
      period: { startDate: start, endDate: end },
      data: result,
    };
  }

  async getHoursByProject(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { where, start, end } = await this.validateAndGetWhere(
      companyId,
      userId,
      userRole,
      query,
    );

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        duration: true,
        projectId: true,
        project: { select: { id: true, name: true, color: true } },
        user: { select: { hourlyRate: true } },
      },
      take: 10000,
    });

    const byProject = new Map<
      string,
      { projectId: string | null; projectName: string; projectColor: string; hours: number; earned: number }
    >();

    entries.forEach((e) => {
      const key = e.projectId || "no-project";
      const hours = (e.duration || 0) / 3600;
      const rate = e.user?.hourlyRate ?? 0;
      const earned = hours * rate;

      if (!byProject.has(key)) {
        byProject.set(key, {
          projectId: e.projectId,
          projectName: e.project?.name || "Без проекта",
          projectColor: e.project?.color || "#6b7280",
          hours: 0,
          earned: 0,
        });
      }
      const item = byProject.get(key)!;
      item.hours += hours;
      item.earned += earned;
    });

    const data = Array.from(byProject.values())
      .map((p) => ({
        ...p,
        hours: Math.round(p.hours * 100) / 100,
        earned: Math.round(p.earned * 100) / 100,
      }))
      .sort((a, b) => b.hours - a.hours);

    return {
      period: { startDate: start, endDate: end },
      data,
    };
  }

  async getProductivity(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { where, start, end } = await this.validateAndGetWhere(
      companyId,
      userId,
      userRole,
      query,
    );

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        duration: true,
        userId: true,
        user: { select: { name: true, hourlyRate: true } },
      },
      take: 10000,
    });

    const byUser = new Map<
      string,
      { userName: string; hours: number; earned: number; entriesCount: number }
    >();

    entries.forEach((e) => {
      if (!byUser.has(e.userId)) {
        byUser.set(e.userId, {
          userName: e.user?.name || "Unknown",
          hours: 0,
          earned: 0,
          entriesCount: 0,
        });
      }
      const item = byUser.get(e.userId)!;
      const hours = (e.duration || 0) / 3600;
      item.hours += hours;
      item.earned += hours * (e.user?.hourlyRate ?? 0);
      item.entriesCount += 1;
    });

    const data = Array.from(byUser.values())
      .map((u) => ({
        ...u,
        hours: Math.round(u.hours * 100) / 100,
        earned: Math.round(u.earned * 100) / 100,
        avgEntryHours:
          u.entriesCount > 0
            ? Math.round((u.hours / u.entriesCount) * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.hours - a.hours);

    const totalHours = data.reduce((s, u) => s + u.hours, 0);
    const daysInPeriod = Math.ceil(
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      period: { startDate: start, endDate: end },
      totalHours: Math.round(totalHours * 100) / 100,
      avgHoursPerDay: daysInPeriod > 0 ? Math.round((totalHours / daysInPeriod) * 100) / 100 : 0,
      byUser: data,
    };
  }

  async compare(
    companyId: string,
    userId: string,
    userRole: string,
    period1: AnalyticsQueryDto,
    period2: AnalyticsQueryDto,
  ) {
    const { start: start1, end: end1 } = this.getDateRange(
      period1.period || AnalyticsPeriod.LAST_30_DAYS,
      period1.startDate,
      period1.endDate,
    );
    const { start: start2, end: end2 } = this.getDateRange(
      period2.period || AnalyticsPeriod.LAST_30_DAYS,
      period2.startDate,
      period2.endDate,
    );

    const baseWhere1: Prisma.TimeEntryWhereInput = {
      user: { companyId },
      status: "STOPPED",
      startTime: { gte: start1, lte: end1 },
    };
    const baseWhere2: Prisma.TimeEntryWhereInput = {
      user: { companyId },
      status: "STOPPED",
      startTime: { gte: start2, lte: end2 },
    };

    const isEmployee = userRole === "EMPLOYEE";
    const effectiveUserId = isEmployee ? userId : period1.userId || period2.userId;
    if (effectiveUserId) {
      if (isEmployee && effectiveUserId !== userId) {
        throw new ForbiddenException("Employees can only view their own analytics");
      }
      baseWhere1.userId = effectiveUserId;
      baseWhere2.userId = effectiveUserId;
    }
    if (period1.projectId) baseWhere1.projectId = period1.projectId;
    if (period2.projectId) baseWhere2.projectId = period2.projectId;

    const [entries1, entries2] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: baseWhere1,
        select: { duration: true },
        take: 10000,
      }),
      this.prisma.timeEntry.findMany({
        where: baseWhere2,
        select: { duration: true },
        take: 10000,
      }),
    ]);

    const hours1 = entries1.reduce((s, e) => s + (e.duration || 0) / 3600, 0);
    const hours2 = entries2.reduce((s, e) => s + (e.duration || 0) / 3600, 0);
    const diff = hours2 - hours1;
    const diffPercent = hours1 > 0 ? (diff / hours1) * 100 : 0;

    return {
      period1: { startDate: start1, endDate: end1, hours: Math.round(hours1 * 100) / 100 },
      period2: { startDate: start2, endDate: end2, hours: Math.round(hours2 * 100) / 100 },
      difference: Math.round(diff * 100) / 100,
      differencePercent: Math.round(diffPercent * 100) / 100,
    };
  }

  async getWorkSessions(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { where, start, end } = await this.validateAndGetWhere(
      companyId,
      userId,
      userRole,
      query,
    );

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    const entries = await this.prisma.timeEntry.findMany({
      where,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        duration: true,
        description: true,
        projectId: true,
        project: { select: { id: true, name: true, color: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: "desc" },
      take: limit,
    });

    const sessions = entries.map((e) => ({
      id: e.id,
      startTime: e.startTime,
      endTime: e.endTime,
      durationSeconds: e.duration || 0,
      durationHours: Math.round(((e.duration || 0) / 3600) * 100) / 100,
      description: e.description,
      projectId: e.projectId,
      projectName: e.project?.name || null,
      projectColor: e.project?.color || null,
      userId: e.user.id,
      userName: e.user.name,
      userEmail: e.user.email,
    }));

    return {
      period: { startDate: start, endDate: end },
      sessions,
      total: sessions.length,
    };
  }

  async getAppsUrls(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ) {
    const { start, end } = this.getDateRange(
      query.period || AnalyticsPeriod.LAST_30_DAYS,
      query.startDate,
      query.endDate,
    );

    const isEmployee = userRole === "EMPLOYEE";
    const effectiveUserId = isEmployee ? userId : query.userId;
    if (isEmployee && query.userId && query.userId !== userId) {
      throw new ForbiddenException(
        "Employees can only view their own analytics",
      );
    }
    if (effectiveUserId) {
      const user = await this.prisma.user.findFirst({
        where: { id: effectiveUserId, companyId, status: "ACTIVE" },
      });
      if (!user) throw new NotFoundException("User not found");
    }
    if (query.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: query.projectId, companyId },
      });
      if (!project) throw new NotFoundException("Project not found");
    }

    const limit = Math.min(Math.max(query.limit ?? 100, 1), 500);

    const timeEntryWhere: Prisma.TimeEntryWhereInput = {
      user: { companyId },
      status: "STOPPED",
      startTime: { gte: start, lte: end },
    };
    if (effectiveUserId) timeEntryWhere.userId = effectiveUserId;
    if (query.projectId) timeEntryWhere.projectId = query.projectId;

    const [appActivities, urlActivities] = await Promise.all([
      this.prisma.appActivity.findMany({
        where: {
          timeEntry: timeEntryWhere,
        },
        select: {
          appName: true,
          windowTitle: true,
          timeSpent: true,
        },
      }),
      this.prisma.urlActivity.findMany({
        where: {
          timeEntry: timeEntryWhere,
        },
        select: {
          url: true,
          domain: true,
          title: true,
          timeSpent: true,
        },
      }),
    ]);

    const appsMap = new Map<
      string,
      { appName: string; windowTitle: string | null; timeSpentSeconds: number; timeSpentHours: number }
    >();
    appActivities.forEach((a) => {
      const key = a.appName;
      if (!appsMap.has(key)) {
        appsMap.set(key, {
          appName: a.appName,
          windowTitle: a.windowTitle,
          timeSpentSeconds: 0,
          timeSpentHours: 0,
        });
      }
      const item = appsMap.get(key)!;
      item.timeSpentSeconds += a.timeSpent || 0;
      item.timeSpentHours = Math.round((item.timeSpentSeconds / 3600) * 100) / 100;
    });

    const urlsMap = new Map<
      string,
      { domain: string; url: string; title: string | null; timeSpentSeconds: number; timeSpentHours: number }
    >();
    urlActivities.forEach((u) => {
      const key = u.domain + "|" + u.url;
      if (!urlsMap.has(key)) {
        urlsMap.set(key, {
          domain: u.domain,
          url: u.url,
          title: u.title,
          timeSpentSeconds: 0,
          timeSpentHours: 0,
        });
      }
      const item = urlsMap.get(key)!;
      item.timeSpentSeconds += u.timeSpent || 0;
      item.timeSpentHours = Math.round((item.timeSpentSeconds / 3600) * 100) / 100;
    });

    const apps = Array.from(appsMap.values())
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
      .slice(0, limit);

    const urls = Array.from(urlsMap.values())
      .sort((a, b) => b.timeSpentSeconds - a.timeSpentSeconds)
      .slice(0, limit);

    return {
      period: { startDate: start, endDate: end },
      apps,
      urls,
    };
  }

  async exportToCsv(
    companyId: string,
    userId: string,
    userRole: string,
    query: AnalyticsQueryDto,
  ): Promise<{ csv: string; filename: string }> {
    const dashboard = await this.getDashboard(
      companyId,
      userId,
      userRole,
      query,
    );
    const hoursByDay = await this.getHoursByDay(
      companyId,
      userId,
      userRole,
      query,
    );

    const lines: string[] = [];
    lines.push("Hubnity Analytics Export");
    lines.push(`Period,${dashboard.period.startDate.toISOString().split("T")[0]} - ${dashboard.period.endDate.toISOString().split("T")[0]}`);
    lines.push("");
    lines.push("Summary");
    lines.push("Total Hours," + dashboard.totalHours);
    lines.push("Total Earned," + dashboard.totalEarned);
    lines.push("Entries Count," + dashboard.entriesCount);
    lines.push("Active Users," + dashboard.activeUsersCount);
    lines.push("Active Projects," + dashboard.activeProjectsCount);
    lines.push("");
    lines.push("Hours by Day");
    lines.push("Date,Hours");
    hoursByDay.data.forEach((d) => {
      lines.push(`${d.date},${d.hours}`);
    });

    const csv = lines.join("\n");
    const filename = `hubnity-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    return { csv, filename };
  }
}
