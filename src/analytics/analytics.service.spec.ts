import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { AnalyticsQueryDto, AnalyticsPeriod } from "./dto/analytics-query.dto";

describe("AnalyticsService", () => {
  let service: AnalyticsService;

  const mockPrismaService = {
    timeEntry: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    appActivity: {
      findMany: jest.fn(),
    },
    urlActivity: {
      findMany: jest.fn(),
    },
  };

  const mockTimeEntry = {
    id: "entry-id",
    userId: "user-id",
    projectId: "project-id",
    startTime: new Date("2025-01-15T10:00:00Z"),
    endTime: new Date("2025-01-15T12:00:00Z"),
    duration: 7200,
    description: "Work",
    status: "STOPPED",
    project: { id: "project-id", name: "Project", color: "#3b82f6" },
    user: { id: "user-id", name: "John", email: "john@example.com" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    jest.clearAllMocks();

    mockPrismaService.user.findFirst.mockResolvedValue({
      id: "user-id",
      name: "John",
      companyId: "company-id",
      status: "ACTIVE",
    });
    mockPrismaService.project.findFirst.mockResolvedValue(null);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getWorkSessions", () => {
    const companyId = "company-id";
    const userId = "user-id";
    const userRole = "ADMIN";
    const query: AnalyticsQueryDto = { period: AnalyticsPeriod.LAST_7_DAYS };

    it("should return work sessions from time entries", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      const result = await service.getWorkSessions(
        companyId,
        userId,
        userRole,
        query,
      );

      expect(result).toHaveProperty("period");
      expect(result).toHaveProperty("sessions");
      expect(result).toHaveProperty("total");
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).toMatchObject({
        id: "entry-id",
        durationSeconds: 7200,
        durationHours: 2,
        projectName: "Project",
        userName: "John",
      });
    });

    it("should use limit from query", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getWorkSessions(companyId, userId, userRole, {
        ...query,
        limit: 50,
      });

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it("should cap limit at 500", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([]);

      await service.getWorkSessions(companyId, userId, userRole, {
        ...query,
        limit: 999,
      });

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        }),
      );
    });
  });

  describe("getAppsUrls", () => {
    const companyId = "company-id";
    const userId = "user-id";
    const userRole = "ADMIN";
    const query: AnalyticsQueryDto = { period: AnalyticsPeriod.LAST_7_DAYS };

    it("should return apps and urls aggregated", async () => {
      mockPrismaService.appActivity.findMany.mockResolvedValue([
        { appName: "Chrome", windowTitle: "Google", timeSpent: 3600 },
      ]);
      mockPrismaService.urlActivity.findMany.mockResolvedValue([
        {
          url: "https://github.com",
          domain: "github.com",
          title: "GitHub",
          timeSpent: 1800,
        },
      ]);

      const result = await service.getAppsUrls(
        companyId,
        userId,
        userRole,
        query,
      );

      expect(result).toHaveProperty("period");
      expect(result).toHaveProperty("apps");
      expect(result).toHaveProperty("urls");
      expect(result.apps).toHaveLength(1);
      expect(result.apps[0]).toMatchObject({
        appName: "Chrome",
        timeSpentSeconds: 3600,
        timeSpentHours: 1,
      });
      expect(result.urls).toHaveLength(1);
      expect(result.urls[0]).toMatchObject({
        domain: "github.com",
        url: "https://github.com",
        timeSpentSeconds: 1800,
        timeSpentHours: 0.5,
      });
    });

    it("should throw ForbiddenException when employee requests other user", async () => {
      await expect(
        service.getAppsUrls(companyId, userId, "EMPLOYEE", {
          ...query,
          userId: "other-user-id",
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("exportToCsv", () => {
    const companyId = "company-id";
    const userId = "user-id";
    const userRole = "ADMIN";
    const query: AnalyticsQueryDto = { period: AnalyticsPeriod.LAST_7_DAYS };

    it("should return csv string and filename", async () => {
      mockPrismaService.timeEntry.findMany
        .mockResolvedValueOnce([
          {
            duration: 3600,
            userId: "user-id",
            projectId: "project-id",
            user: { hourlyRate: 50 },
          },
        ])
        .mockResolvedValueOnce([
          {
            startTime: new Date("2025-01-15"),
            duration: 3600,
          },
        ]);

      const result = await service.exportToCsv(
        companyId,
        userId,
        userRole,
        query,
      );

      expect(result).toHaveProperty("csv");
      expect(result).toHaveProperty("filename");
      expect(result.filename).toMatch(/^hubnity-analytics-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.csv).toContain("Hubnity Analytics Export");
      expect(result.csv).toContain("Total Hours");
      expect(result.csv).toContain("Hours by Day");
    });
  });
});
