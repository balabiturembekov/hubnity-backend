import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { TimeEntriesService } from "./time-entries.service";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { CacheService } from "../cache/cache.service";

describe("TimeEntriesService", () => {
  let service: TimeEntriesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEventsGateway = {
    broadcastStatsUpdate: jest.fn(),
    broadcastTimeEntryUpdate: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidate: jest.fn(),
  };

  const mockTimeEntry = {
    id: "entry-id",
    userId: "user-id",
    projectId: "project-id",
    startTime: new Date(),
    endTime: null,
    duration: 0,
    description: "Work",
    status: "RUNNING",
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: "user-id", name: "John", email: "john@example.com" },
    project: { id: "project-id", name: "Project", color: "#3b82f6" },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntriesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EventsGateway,
          useValue: mockEventsGateway,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<TimeEntriesService>(TimeEntriesService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findAll", () => {
    const companyId = "company-id";

    it("should use default limit 100 when not provided", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      await service.findAll(companyId);

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { companyId } },
          take: 100,
          orderBy: { startTime: "desc" },
        }),
      );
    });

    it("should pass custom limit to findMany", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      await service.findAll(companyId, undefined, undefined, 50);

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { companyId } },
          take: 50,
        }),
      );
    });

    it("should pass limit 1000 when max value provided", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      await service.findAll(companyId, undefined, undefined, 1000);

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });

    it("should filter by userId when provided", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: "user-id" });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      await service.findAll(companyId, "user-id", undefined, 25);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { id: "user-id", companyId },
        select: { id: true },
      });
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { companyId }, userId: "user-id" },
          take: 25,
        }),
      );
    });

    it("should filter by projectId when provided", async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: "project-id",
      });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([mockTimeEntry]);

      await service.findAll(companyId, undefined, "project-id", 10);

      expect(mockPrismaService.project.findFirst).toHaveBeenCalledWith({
        where: { id: "project-id", companyId },
      });
      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { companyId }, projectId: "project-id" },
          take: 10,
        }),
      );
    });

    it("should throw NotFoundException when userId not found in company", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(companyId, "unknown-user", undefined, 100),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.timeEntry.findMany).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when projectId not found in company", async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.findAll(companyId, undefined, "unknown-project", 100),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.timeEntry.findMany).not.toHaveBeenCalled();
    });
  });

  describe("findPending", () => {
    const companyId = "company-id";
    const pendingEntry = {
      ...mockTimeEntry,
      status: "STOPPED",
      approvalStatus: "PENDING",
    };

    it("should return pending entries for company", async () => {
      mockPrismaService.timeEntry.findMany.mockResolvedValue([pendingEntry]);

      const result = await service.findPending(companyId, undefined, 100);

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: { companyId },
            status: "STOPPED",
            approvalStatus: "PENDING",
          },
          take: 100,
        }),
      );
      expect(result).toEqual([pendingEntry]);
    });

    it("should filter by userId when provided", async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: "user-id" });
      mockPrismaService.timeEntry.findMany.mockResolvedValue([pendingEntry]);

      await service.findPending(companyId, "user-id", 50);

      expect(mockPrismaService.timeEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user: { companyId },
            userId: "user-id",
            status: "STOPPED",
            approvalStatus: "PENDING",
          },
          take: 50,
        }),
      );
    });
  });

  describe("approve", () => {
    const companyId = "company-id";
    const entryId = "entry-id";
    const approverId = "admin-id";
    const approvedEntry = {
      ...mockTimeEntry,
      id: entryId,
      status: "STOPPED",
      approvalStatus: "APPROVED",
      approvedBy: approverId,
      approvedAt: expect.any(Date),
    };

    it("should approve a pending time entry", async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue({
        ...mockTimeEntry,
        id: entryId,
        status: "STOPPED",
        approvalStatus: "PENDING",
        user: { companyId },
      });
      mockPrismaService.timeEntry.update.mockResolvedValue(approvedEntry);

      const result = await service.approve(entryId, companyId, approverId);

      expect(mockPrismaService.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: entryId },
          data: expect.objectContaining({
            approvalStatus: "APPROVED",
            approvedBy: approverId,
          }),
        }),
      );
      expect(result).toEqual(approvedEntry);
    });

    it("should throw NotFoundException when entry not found", async () => {
      mockPrismaService.timeEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.approve(entryId, companyId, approverId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw BadRequestException when entry is not pending", async () => {
      const { BadRequestException } = await import("@nestjs/common");
      mockPrismaService.timeEntry.findFirst.mockResolvedValue({
        ...mockTimeEntry,
        approvalStatus: "APPROVED",
        user: { companyId },
      });

      await expect(
        service.approve(entryId, companyId, approverId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("reject", () => {
    const companyId = "company-id";
    const entryId = "entry-id";
    const approverId = "admin-id";
    const rejectionComment = "Недостаточно деталей";

    it("should reject a pending time entry with comment", async () => {
      const rejectedEntry = {
        ...mockTimeEntry,
        id: entryId,
        status: "STOPPED",
        approvalStatus: "REJECTED",
        approvedBy: approverId,
        approvedAt: expect.any(Date),
        rejectionComment,
      };
      mockPrismaService.timeEntry.findFirst.mockResolvedValue({
        ...mockTimeEntry,
        id: entryId,
        status: "STOPPED",
        approvalStatus: "PENDING",
        user: { companyId },
      });
      mockPrismaService.timeEntry.update.mockResolvedValue(rejectedEntry);

      const result = await service.reject(
        entryId,
        companyId,
        approverId,
        rejectionComment,
      );

      expect(mockPrismaService.timeEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: entryId },
          data: expect.objectContaining({
            approvalStatus: "REJECTED",
            approvedBy: approverId,
            rejectionComment,
          }),
        }),
      );
      expect(result).toEqual(rejectedEntry);
    });
  });

  describe("bulkApprove", () => {
    const companyId = "company-id";
    const approverId = "admin-id";
    const ids = ["id-1", "id-2"];

    it("should approve multiple pending entries", async () => {
      mockPrismaService.timeEntry.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkApprove(ids, companyId, approverId);

      expect(mockPrismaService.timeEntry.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          user: { companyId },
          approvalStatus: "PENDING",
        },
        data: expect.objectContaining({
          approvalStatus: "APPROVED",
          approvedBy: approverId,
        }),
      });
      expect(result.approvedCount).toBe(2);
    });
  });

  describe("bulkReject", () => {
    const companyId = "company-id";
    const approverId = "admin-id";
    const ids = ["id-1", "id-2"];
    const rejectionComment = "Требуется уточнение";

    it("should reject multiple pending entries with comment", async () => {
      mockPrismaService.timeEntry.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkReject(
        ids,
        companyId,
        approverId,
        rejectionComment,
      );

      expect(mockPrismaService.timeEntry.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ids },
          user: { companyId },
          approvalStatus: "PENDING",
        },
        data: expect.objectContaining({
          approvalStatus: "REJECTED",
          approvedBy: approverId,
          rejectionComment,
        }),
      });
      expect(result.rejectedCount).toBe(2);
    });
  });
});
