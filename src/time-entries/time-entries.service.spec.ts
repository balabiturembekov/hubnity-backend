import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { TimeEntriesService } from "./time-entries.service";
import { TimeEntriesActionService } from "./time-entries-action.service";
import { TimeEntriesApprovalService } from "./time-entries-approval.service";
import { PrismaService } from "../prisma/prisma.service";

describe("TimeEntriesService", () => {
  let service: TimeEntriesService;
  let prismaService: PrismaService;

  const mockActionService = {
    create: jest.fn(),
    sync: jest.fn(),
    update: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    remove: jest.fn(),
  };

  const mockApprovalService = {
    findPending: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    bulkApprove: jest.fn(),
    bulkReject: jest.fn(),
  };

  const mockPrismaService = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    activity: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback(mockPrismaService),
    ),
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
          provide: TimeEntriesActionService,
          useValue: mockActionService,
        },
        {
          provide: TimeEntriesApprovalService,
          useValue: mockApprovalService,
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

    it("should delegate to approvalService and return pending entries", async () => {
      mockApprovalService.findPending.mockResolvedValue([pendingEntry]);

      const result = await service.findPending(companyId, undefined, 100);

      expect(mockApprovalService.findPending).toHaveBeenCalledWith(
        companyId,
        undefined,
        100,
      );
      expect(result).toEqual([pendingEntry]);
    });

    it("should pass userId and limit to approvalService", async () => {
      mockApprovalService.findPending.mockResolvedValue([pendingEntry]);

      await service.findPending(companyId, "user-id", 50);

      expect(mockApprovalService.findPending).toHaveBeenCalledWith(
        companyId,
        "user-id",
        50,
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

    it("should delegate to approvalService and return approved entry", async () => {
      mockApprovalService.approve.mockResolvedValue(approvedEntry);

      const result = await service.approve(entryId, companyId, approverId);

      expect(mockApprovalService.approve).toHaveBeenCalledWith(
        entryId,
        companyId,
        approverId,
      );
      expect(result).toEqual(approvedEntry);
    });

    it("should propagate NotFoundException from approvalService", async () => {
      mockApprovalService.approve.mockRejectedValue(
        new NotFoundException("Time entry with ID entry-id not found"),
      );

      await expect(
        service.approve(entryId, companyId, approverId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should propagate BadRequestException from approvalService", async () => {
      mockApprovalService.approve.mockRejectedValue(
        new BadRequestException("Time entry is not pending approval"),
      );

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

    it("should delegate to approvalService and return rejected entry", async () => {
      const rejectedEntry = {
        ...mockTimeEntry,
        id: entryId,
        status: "STOPPED",
        approvalStatus: "REJECTED",
        approvedBy: approverId,
        approvedAt: expect.any(Date),
        rejectionComment,
      };
      mockApprovalService.reject.mockResolvedValue(rejectedEntry);

      const result = await service.reject(
        entryId,
        companyId,
        approverId,
        rejectionComment,
      );

      expect(mockApprovalService.reject).toHaveBeenCalledWith(
        entryId,
        companyId,
        approverId,
        rejectionComment,
      );
      expect(result).toEqual(rejectedEntry);
    });
  });

  describe("bulkApprove", () => {
    const companyId = "company-id";
    const approverId = "admin-id";
    const ids = ["id-1", "id-2"];

    it("should delegate to approvalService and return approved count", async () => {
      mockApprovalService.bulkApprove.mockResolvedValue({ approvedCount: 2 });

      const result = await service.bulkApprove(ids, companyId, approverId);

      expect(mockApprovalService.bulkApprove).toHaveBeenCalledWith(
        ids,
        companyId,
        approverId,
      );
      expect(result.approvedCount).toBe(2);
    });
  });

  describe("bulkReject", () => {
    const companyId = "company-id";
    const approverId = "admin-id";
    const ids = ["id-1", "id-2"];
    const rejectionComment = "Требуется уточнение";

    it("should delegate to approvalService and return rejected count", async () => {
      mockApprovalService.bulkReject.mockResolvedValue({ rejectedCount: 2 });

      const result = await service.bulkReject(
        ids,
        companyId,
        approverId,
        rejectionComment,
      );

      expect(mockApprovalService.bulkReject).toHaveBeenCalledWith(
        ids,
        companyId,
        approverId,
        rejectionComment,
      );
      expect(result.rejectedCount).toBe(2);
    });
  });

  describe("remove", () => {
    const companyId = "company-id";
    const entryId = "entry-id";

    it("should delegate to actionService", async () => {
      const deleted = { id: entryId };
      mockActionService.remove.mockResolvedValue(deleted);

      const result = await service.remove(
        entryId,
        companyId,
        "admin-id",
        "ADMIN" as never,
      );

      expect(mockActionService.remove).toHaveBeenCalledWith(
        entryId,
        companyId,
        "admin-id",
        "ADMIN",
      );
      expect(result).toEqual(deleted);
    });

    it("should propagate BadRequestException from actionService", async () => {
      mockActionService.remove.mockRejectedValue(
        new BadRequestException(
          "Only pending time entries can be deleted. Approved or rejected entries are locked.",
        ),
      );

      await expect(
        service.remove(entryId, companyId, "emp-id", "EMPLOYEE" as never),
      ).rejects.toThrow(BadRequestException);
    });

    it("should propagate NotFoundException from actionService", async () => {
      mockActionService.remove.mockRejectedValue(
        new NotFoundException(`Time entry with ID ${entryId} not found`),
      );

      await expect(
        service.remove(entryId, companyId, "admin-id", "ADMIN" as never),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
