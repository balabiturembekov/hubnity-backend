import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";

describe("NotificationsService", () => {
  let service: NotificationsService;

  const mockPrismaService = {
    notification: {
      create: jest.fn(),
      createManyAndReturn: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockEventsGateway = {
    notifyUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    it("should create notification and send via WebSocket", async () => {
      const params = {
        userId: "user-1",
        companyId: "company-1",
        type: "TIME_ENTRY_APPROVED" as const,
        title: "Test",
        message: "Test message",
      };
      const mockNotification = {
        id: "notif-1",
        ...params,
        readAt: null,
        metadata: null,
        createdAt: new Date(),
      };
      mockPrismaService.notification.create.mockResolvedValue(mockNotification);

      const result = await service.create(params);

      expect(result).toEqual(mockNotification);
      expect(mockEventsGateway.notifyUser).toHaveBeenCalledWith(
        "user-1",
        "notification:new",
        expect.objectContaining({
          id: "notif-1",
          type: "TIME_ENTRY_APPROVED",
          title: "Test",
          message: "Test message",
        }),
      );
    });

    it("should not throw when WebSocket fails", async () => {
      mockPrismaService.notification.create.mockResolvedValue({
        id: "notif-1",
        userId: "user-1",
        companyId: "company-1",
        type: "TIME_ENTRY_APPROVED",
        title: "Test",
        message: "Test",
        readAt: null,
        metadata: null,
        createdAt: new Date(),
      });
      mockEventsGateway.notifyUser.mockImplementation(() => {
        throw new Error("WebSocket error");
      });

      const result = await service.create({
        userId: "user-1",
        companyId: "company-1",
        type: "TIME_ENTRY_APPROVED",
        title: "Test",
        message: "Test",
      });

      expect(result.id).toBe("notif-1");
    });
  });

  describe("createForUsers", () => {
    it("should deduplicate userIds", async () => {
      mockPrismaService.notification.createManyAndReturn.mockResolvedValue([
        { id: "n1", userId: "user-1", type: "USER_ADDED", title: "T", message: "M", readAt: null, companyId: "c1", metadata: null, createdAt: new Date() },
      ]);

      await service.createForUsers(
        ["user-1", "user-1", "user-1"],
        "company-1",
        "USER_ADDED",
        "Title",
        "Message",
      );

      expect(mockPrismaService.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [{ userId: "user-1", companyId: "company-1", type: "USER_ADDED", title: "Title", message: "Message", metadata: undefined }],
      });
    });

    it("should return empty array when userIds is empty", async () => {
      const result = await service.createForUsers(
        [],
        "company-1",
        "USER_ADDED",
        "T",
        "M",
      );

      expect(result).toEqual([]);
      expect(mockPrismaService.notification.createManyAndReturn).not.toHaveBeenCalled();
    });

    it("should pass metadata to createManyAndReturn", async () => {
      const metadata = { timeEntryId: "te-1", actorName: "Admin" };
      mockPrismaService.notification.createManyAndReturn.mockResolvedValue([
        { id: "n1", userId: "user-1", type: "TIME_ENTRY_APPROVED", title: "T", message: "M", readAt: null, companyId: "c1", metadata, createdAt: new Date() },
      ]);

      await service.createForUsers(
        ["user-1"],
        "company-1",
        "TIME_ENTRY_APPROVED",
        "T",
        "M",
        metadata,
      );

      expect(mockPrismaService.notification.createManyAndReturn).toHaveBeenCalledWith({
        data: [{ userId: "user-1", companyId: "company-1", type: "TIME_ENTRY_APPROVED", title: "T", message: "M", metadata }],
      });
    });

    it("should limit to 100 recipients", async () => {
      const manyIds = Array.from({ length: 150 }, (_, i) => `user-${i}`);
      mockPrismaService.notification.createManyAndReturn.mockResolvedValue([]);

      await service.createForUsers(
        manyIds,
        "company-1",
        "USER_ADDED",
        "T",
        "M",
      );

      const callData = mockPrismaService.notification.createManyAndReturn.mock.calls[0][0].data;
      expect(callData).toHaveLength(100);
    });
  });

  describe("findAll", () => {
    it("should return paginated notifications with defaults", async () => {
      const mockItems = [
        { id: "n1", userId: "u1", companyId: "c1", type: "USER_ADDED", title: "T", message: "M", readAt: null, metadata: null, createdAt: new Date() },
      ];
      mockPrismaService.notification.findMany.mockResolvedValue(mockItems);
      mockPrismaService.notification.count.mockResolvedValue(1);

      const result = await service.findAll("user-1", "company-1");

      expect(result).toEqual({ items: mockItems, total: 1, limit: 20, offset: 0 });
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith({
        where: { userId: "user-1", companyId: "company-1" },
        orderBy: { createdAt: "desc" },
        take: 20,
        skip: 0,
      });
    });

    it("should filter by unreadOnly when true", async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll("user-1", "company-1", { unreadOnly: true });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1", companyId: "company-1", readAt: null },
        }),
      );
    });

    it("should apply limit and offset", async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(50);

      const result = await service.findAll("user-1", "company-1", {
        limit: 10,
        offset: 20,
      });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(result.total).toBe(50);
      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 }),
      );
    });

    it("should clamp limit to 100 max", async () => {
      mockPrismaService.notification.findMany.mockResolvedValue([]);
      mockPrismaService.notification.count.mockResolvedValue(0);

      await service.findAll("user-1", "company-1", { limit: 500 });

      expect(mockPrismaService.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe("getUnreadCount", () => {
    it("should return count of unread notifications", async () => {
      mockPrismaService.notification.count.mockResolvedValue(7);

      const result = await service.getUnreadCount("user-1", "company-1");

      expect(result).toBe(7);
      expect(mockPrismaService.notification.count).toHaveBeenCalledWith({
        where: { userId: "user-1", companyId: "company-1", readAt: null },
      });
    });
  });

  describe("markAsRead", () => {
    it("should mark only unread when ids not provided", async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAsRead("user-1", "company-1");

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", companyId: "company-1", readAt: null },
        data: { readAt: expect.any(Date) },
      });
      expect(result.updatedCount).toBe(5);
    });

    it("should mark specific ids when provided", async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markAsRead("user-1", "company-1", [
        "id-1",
        "id-2",
      ]);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", companyId: "company-1", id: { in: ["id-1", "id-2"] } },
        data: { readAt: expect.any(Date) },
      });
      expect(result.updatedCount).toBe(2);
    });

    it("should deduplicate ids", async () => {
      mockPrismaService.notification.updateMany.mockResolvedValue({ count: 1 });

      await service.markAsRead("user-1", "company-1", [
        "id-1",
        "id-1",
        "id-1",
      ]);

      expect(mockPrismaService.notification.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", companyId: "company-1", id: { in: ["id-1"] } },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  describe("findOne", () => {
    it("should throw NotFoundException for invalid UUID", async () => {
      await expect(
        service.findOne("invalid-uuid", "user-1", "company-1"),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.notification.findFirst).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when not found", async () => {
      mockPrismaService.notification.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(
          "550e8400-e29b-41d4-a716-446655440000",
          "user-1",
          "company-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it("should return notification when found", async () => {
      const mockNotif = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: "user-1",
        companyId: "company-1",
        type: "TIME_ENTRY_APPROVED",
        title: "T",
        message: "M",
        readAt: null,
        metadata: null,
        createdAt: new Date(),
      };
      mockPrismaService.notification.findFirst.mockResolvedValue(mockNotif);

      const result = await service.findOne(
        "550e8400-e29b-41d4-a716-446655440000",
        "user-1",
        "company-1",
      );

      expect(result).toEqual(mockNotif);
    });
  });
});
