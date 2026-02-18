import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesService } from "./time-entries.service";
import { RejectTimeEntryDto } from "./dto/reject-time-entry.dto";
import { BulkApproveDto } from "./dto/bulk-approve.dto";
import { BulkRejectDto } from "./dto/bulk-reject.dto";

describe("TimeEntriesController", () => {
  let controller: TimeEntriesController;
  let timeEntriesService: TimeEntriesService;

  const mockTimeEntriesService = {
    findAll: jest.fn(),
    findActive: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findPending: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    bulkApprove: jest.fn(),
    bulkReject: jest.fn(),
  };

  const mockUser = {
    id: "user-id",
    name: "John Doe",
    email: "john@example.com",
    role: "EMPLOYEE" as const,
    companyId: "company-id",
  };

  const mockOwner = {
    ...mockUser,
    role: "OWNER" as const,
  };

  const mockAdmin = {
    ...mockUser,
    role: "ADMIN" as const,
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
      controllers: [TimeEntriesController],
      providers: [
        {
          provide: TimeEntriesService,
          useValue: mockTimeEntriesService,
        },
      ],
    }).compile();

    controller = module.get<TimeEntriesController>(TimeEntriesController);
    timeEntriesService = module.get<TimeEntriesService>(TimeEntriesService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    const mockEntries = [mockTimeEntry];

    it("should use default limit 100 when limit not provided (employee)", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser);

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        100,
        undefined,
        undefined,
      );
    });

    it("should pass limit to service when provided (employee)", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser, undefined, undefined, "50");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        50,
        undefined,
        undefined,
      );
    });

    it("should pass limit to service when provided (admin)", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockAdmin, "target-user-id", "project-id", "25");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockAdmin.companyId,
        "target-user-id",
        "project-id",
        25,
        undefined,
        undefined,
      );
    });

    it("should cap limit at 1000 when exceeding max", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser, undefined, undefined, "5000");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        100,
        undefined,
        undefined,
      );
    });

    it("should use default 100 when limit is invalid (non-numeric)", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser, undefined, undefined, "invalid");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        100,
        undefined,
        undefined,
      );
    });

    it("should use default 100 when limit is zero or negative", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser, undefined, undefined, "0");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        100,
        undefined,
        undefined,
      );
    });

    it("should accept limit of 1000 (max)", async () => {
      mockTimeEntriesService.findAll.mockResolvedValue(mockEntries);

      await controller.findAll(mockUser, undefined, undefined, "1000");

      expect(timeEntriesService.findAll).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        undefined,
        1000,
        undefined,
        undefined,
      );
    });
  });

  describe("findPending", () => {
    const mockPendingEntries = mockTimeEntry;

    it("should return pending entries for admin", async () => {
      mockTimeEntriesService.findPending.mockResolvedValue([
        mockPendingEntries,
      ]);

      const result = await controller.findPending(mockAdmin, undefined, "50");

      expect(timeEntriesService.findPending).toHaveBeenCalledWith(
        mockAdmin.companyId,
        undefined,
        50,
      );
      expect(result).toEqual([mockPendingEntries]);
    });

    it("should filter by userId when admin provides it", async () => {
      mockTimeEntriesService.findPending.mockResolvedValue([
        mockPendingEntries,
      ]);

      await controller.findPending(mockAdmin, "target-user-id", "25");

      expect(timeEntriesService.findPending).toHaveBeenCalledWith(
        mockAdmin.companyId,
        "target-user-id",
        25,
      );
    });

    it("should return only own pending entries for employee", async () => {
      mockTimeEntriesService.findPending.mockResolvedValue([
        mockPendingEntries,
      ]);

      await controller.findPending(mockUser, undefined, "100");

      expect(timeEntriesService.findPending).toHaveBeenCalledWith(
        mockUser.companyId,
        mockUser.id,
        100,
      );
    });

    it("should throw ForbiddenException if employee tries to filter by other userId", () => {
      expect(() =>
        controller.findPending(mockUser, "other-user-id", "100"),
      ).toThrow(ForbiddenException);
      expect(timeEntriesService.findPending).not.toHaveBeenCalled();
    });
  });

  describe("approve", () => {
    const entryId = "entry-id";
    const approvedEntry = { ...mockTimeEntry, approvalStatus: "APPROVED" };

    it("should approve time entry for admin", async () => {
      mockTimeEntriesService.approve.mockResolvedValue(approvedEntry);

      const result = await controller.approve(entryId, mockAdmin);

      expect(timeEntriesService.approve).toHaveBeenCalledWith(
        entryId,
        mockAdmin.companyId,
        mockAdmin.id,
      );
      expect(result).toEqual(approvedEntry);
    });

    it("should approve time entry for owner", async () => {
      mockTimeEntriesService.approve.mockResolvedValue(approvedEntry);

      await controller.approve(entryId, mockOwner);

      expect(timeEntriesService.approve).toHaveBeenCalledWith(
        entryId,
        mockOwner.companyId,
        mockOwner.id,
      );
    });
  });

  describe("reject", () => {
    const entryId = "entry-id";
    const dto: RejectTimeEntryDto = {
      rejectionComment: "Недостаточно деталей",
    };
    const rejectedEntry = { ...mockTimeEntry, approvalStatus: "REJECTED" };

    it("should reject time entry with comment for admin", async () => {
      mockTimeEntriesService.reject.mockResolvedValue(rejectedEntry);

      const result = await controller.reject(entryId, dto, mockAdmin);

      expect(timeEntriesService.reject).toHaveBeenCalledWith(
        entryId,
        mockAdmin.companyId,
        mockAdmin.id,
        dto.rejectionComment,
      );
      expect(result).toEqual(rejectedEntry);
    });
  });

  describe("bulkApprove", () => {
    const dto: BulkApproveDto = { ids: ["id-1", "id-2"] };

    it("should bulk approve for admin", async () => {
      mockTimeEntriesService.bulkApprove.mockResolvedValue({
        approvedCount: 2,
      });

      const result = await controller.bulkApprove(dto, mockAdmin);

      expect(timeEntriesService.bulkApprove).toHaveBeenCalledWith(
        dto.ids,
        mockAdmin.companyId,
        mockAdmin.id,
      );
      expect(result).toEqual({ approvedCount: 2 });
    });
  });

  describe("bulkReject", () => {
    const dto: BulkRejectDto = {
      ids: ["id-1", "id-2"],
      rejectionComment: "Требуется уточнение",
    };

    it("should bulk reject for admin", async () => {
      mockTimeEntriesService.bulkReject.mockResolvedValue({
        rejectedCount: 2,
      });

      const result = await controller.bulkReject(dto, mockAdmin);

      expect(timeEntriesService.bulkReject).toHaveBeenCalledWith(
        dto.ids,
        mockAdmin.companyId,
        mockAdmin.id,
        dto.rejectionComment,
      );
      expect(result).toEqual({ rejectedCount: 2 });
    });
  });
});
