import { Injectable, NotFoundException } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { PrismaService } from "../prisma/prisma.service";
import {
  TeamActivityQueryDto,
  ActivityPeriod,
} from "./dto/team-activity-query.dto";

@Injectable()
export class TeamActivityService {
  constructor(
    private prisma: PrismaService,
    private logger: PinoLogger,
  ) {
    this.logger.setContext(TeamActivityService.name);
  }

  getDateRange(
    period: ActivityPeriod,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    let end: Date;

    if (period === ActivityPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        this.logger.warn(
          { startDate, endDate },
          "Invalid date format provided, falling back to default period",
        );
        period = ActivityPeriod.LAST_30_DAYS;
      } else {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        if (start >= end) {
          this.logger.warn(
            { startDate, endDate },
            "Start date must be before end date, falling back to default period",
          );
          period = ActivityPeriod.LAST_30_DAYS;
        } else {
          return { start, end };
        }
      }
    }

    switch (period) {
      case ActivityPeriod.TODAY:
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0,
        );
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.YESTERDAY:
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          0,
          0,
          0,
          0,
        );
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.LAST_7_DAYS:
        start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.LAST_30_DAYS:
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.LAST_90_DAYS:
        start = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.THIS_MONTH:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      case ActivityPeriod.LAST_MONTH:
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case ActivityPeriod.THIS_YEAR:
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
        break;
      default:
        start = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
          999,
        );
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      this.logger.error(
        { period, start, end },
        "Invalid date range calculated, using safe fallback",
      );
      start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      );
    }

    return { start, end };
  }

  async getTeamActivity(
    companyId: string,
    userId: string,
    userRole: string,
    query: TeamActivityQueryDto,
  ) {
    const { start, end } = this.getDateRange(
      query.period || ActivityPeriod.LAST_30_DAYS,
      query.startDate,
      query.endDate,
    );
    const isEmployee = userRole === "EMPLOYEE";
    const effectiveUserId = isEmployee ? userId : query.userId || undefined;

    const where: any = {
      companyId,
      status: "ACTIVE",
    };

    if (effectiveUserId) {
      const userCheck = await this.prisma.user.findFirst({
        where: {
          id: effectiveUserId,
          companyId,
        },
      });

      if (!userCheck) {
        throw new NotFoundException(
          `User with ID ${effectiveUserId} not found in your company`,
        );
      }

      // Explicitly add id filter to where clause
      where.id = effectiveUserId;
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        hourlyRate: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    if (users.length === 0) {
      return {
        period: { startDate: start, endDate: end },
        totalMembers: 0,
        totalHours: 0,
        totalEarned: 0,
        members: [],
      };
    }

    const timeEntriesWhere: any = {
      user: {
        companyId,
      },
      status: "STOPPED",
      startTime: {
        gte: start,
        lte: end,
      },
    };

    if (effectiveUserId) {
      timeEntriesWhere.userId = effectiveUserId;
    }

    if (query.projectId) {
      const projectCheck = await this.prisma.project.findFirst({
        where: {
          id: query.projectId,
          companyId,
        },
      });

      if (!projectCheck) {
        throw new NotFoundException(
          `Project with ID ${query.projectId} not found in your company`,
        );
      }

      timeEntriesWhere.projectId = query.projectId;
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: timeEntriesWhere,
      select: {
        id: true,
        userId: true,
        projectId: true,
        duration: true,
        startTime: true,
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            hourlyRate: true,
          },
        },
      },
      orderBy: {
        startTime: "desc",
      },
    });

    const membersMap = new Map<string, any>();

    users.forEach((user) => {
      membersMap.set(user.id, {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userAvatar: user.avatar,
        userRole: user.role,
        hourlyRate: user.hourlyRate,
        totalHours: 0,
        totalEarned: 0,
        activityLevel: "low" as "low" | "medium" | "high",
        projectBreakdown: [] as any[],
        entriesCount: 0,
        lastActivity: null as Date | null,
      });
    });

    const projectMap = new Map<
      string,
      Map<string, { hours: number; earned: number }>
    >();

    timeEntries.forEach((entry) => {
      const member = membersMap.get(entry.userId);
      if (!member) return;

      const duration = entry.duration ?? 0;
      if (!isFinite(duration) || duration < 0 || duration > 2147483647) {
        this.logger.warn(
          { entryId: entry.id, duration, userId: entry.userId },
          "Invalid duration value, skipping entry",
        );
        return;
      }

      const hours = duration / 3600;
      if (!isFinite(hours) || hours < 0) {
        this.logger.warn(
          { entryId: entry.id, hours },
          "Invalid hours calculation, skipping entry",
        );
        return;
      }

      const hourlyRate = member.hourlyRate ?? 0;
      if (!isFinite(hourlyRate) || hourlyRate < 0) {
        this.logger.warn(
          { userId: member.userId, hourlyRate },
          "Invalid hourlyRate, using 0",
        );
      }

      const earned = hours * hourlyRate;
      if (!isFinite(earned) || earned < 0) {
        this.logger.warn(
          { entryId: entry.id, earned },
          "Invalid earned calculation, skipping entry",
        );
        return;
      }

      member.totalHours += hours;
      member.totalEarned += earned;
      member.entriesCount += 1;

      if (
        entry.startTime &&
        (!member.lastActivity || entry.startTime > member.lastActivity)
      ) {
        try {
          const startTimeDate = new Date(entry.startTime);
          if (!isNaN(startTimeDate.getTime())) {
            member.lastActivity = startTimeDate;
          }
        } catch (error) {
          this.logger.warn(
            { entryId: entry.id, startTime: entry.startTime },
            "Invalid startTime format",
          );
        }
      }

      const projectKey = entry.projectId || "no-project";
      if (!projectMap.has(member.userId)) {
        projectMap.set(member.userId, new Map());
      }

      const userProjectMap = projectMap.get(member.userId)!;
      if (!userProjectMap.has(projectKey)) {
        userProjectMap.set(projectKey, { hours: 0, earned: 0 });
      }

      const projectStats = userProjectMap.get(projectKey)!;
      projectStats.hours += hours;
      projectStats.earned += earned;
    });

    membersMap.forEach((member, userId) => {
      const userProjectMap = projectMap.get(userId);
      if (!userProjectMap) {
        member.projectBreakdown = [];
        return;
      }

      member.projectBreakdown = Array.from(userProjectMap.entries())
        .map(([projectId, stats]) => {
          if (
            !isFinite(stats.hours) ||
            stats.hours < 0 ||
            !isFinite(stats.earned) ||
            stats.earned < 0
          ) {
            this.logger.warn(
              { userId, projectId, stats },
              "Invalid project stats, skipping",
            );
            return null;
          }

          const entry = timeEntries.find(
            (e) =>
              (e.projectId || "no-project") === projectId &&
              e.userId === userId,
          );
          return {
            projectId: projectId === "no-project" ? null : projectId,
            projectName: entry?.project?.name || "No Project",
            projectColor: entry?.project?.color || "#6b7280",
            hours: stats.hours,
            earned: stats.earned,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      member.projectBreakdown.sort((a, b) => b.hours - a.hours);
    });

    const allHours = Array.from(membersMap.values())
      .map((m) => m.totalHours)
      .filter((h) => isFinite(h) && h >= 0);

    const maxHours = allHours.length > 0 ? Math.max(...allHours, 0) : 0;
    const avgHours =
      allHours.length > 0
        ? allHours.reduce((a, b) => a + b, 0) / allHours.length
        : 0;

    membersMap.forEach((member) => {
      if (!isFinite(member.totalHours) || member.totalHours < 0) {
        member.activityLevel = "low";
        return;
      }

      if (avgHours <= 0) {
        member.activityLevel = member.totalHours > 0 ? "high" : "low";
        return;
      }

      if (member.totalHours >= avgHours * 1.5) {
        member.activityLevel = "high";
      } else if (member.totalHours >= avgHours * 0.5) {
        member.activityLevel = "medium";
      } else {
        member.activityLevel = "low";
      }
    });

    const members = Array.from(membersMap.values()).sort(
      (a, b) => b.totalHours - a.totalHours,
    );

    const totalHours = members.reduce((sum, m) => {
      const hours =
        isFinite(m.totalHours) && m.totalHours >= 0 ? m.totalHours : 0;
      return sum + hours;
    }, 0);

    const totalEarned = members.reduce((sum, m) => {
      const earned =
        isFinite(m.totalEarned) && m.totalEarned >= 0 ? m.totalEarned : 0;
      return sum + earned;
    }, 0);

    return {
      period: { startDate: start, endDate: end },
      totalMembers: members.length,
      totalHours,
      totalEarned,
      members,
    };
  }
}
