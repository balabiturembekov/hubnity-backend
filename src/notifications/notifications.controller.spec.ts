import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let controller: NotificationsController;
  let notificationsService: NotificationsService;

  const mockNotificationsService = {
    findAll: jest.fn(),
    getUnreadCount: jest.fn(),
    findOne: jest.fn(),
    markAsRead: jest.fn(),
  };

  const mockUser = {
    id: "user-id",
    name: "John Doe",
    email: "john@example.com",
    companyId: "company-id",
  };

  const mockNotification = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: "user-id",
    companyId: "company-id",
    type: "TIME_ENTRY_APPROVED",
    title: "Запись одобрена",
    message: "Ваша запись времени была одобрена.",
    readAt: null,
    metadata: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    notificationsService = module.get<NotificationsService>(NotificationsService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findAll", () => {
    it("should return paginated notifications", async () => {
      const mockResult = {
        items: [mockNotification],
        total: 1,
        limit: 20,
        offset: 0,
      };
      mockNotificationsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockUser, {});

      expect(result).toEqual(mockResult);
      expect(notificationsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
        { unreadOnly: undefined, limit: undefined, offset: undefined },
      );
    });

    it("should pass query params to service", async () => {
      mockNotificationsService.findAll.mockResolvedValue({ items: [], total: 0, limit: 10, offset: 5 });

      await controller.findAll(mockUser, {
        unreadOnly: true,
        limit: 10,
        offset: 5,
      });

      expect(notificationsService.findAll).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
        { unreadOnly: true, limit: 10, offset: 5 },
      );
    });
  });

  describe("getUnreadCount", () => {
    it("should return unread count", async () => {
      mockNotificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockUser);

      expect(result).toEqual({ count: 5 });
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
      );
    });
  });

  describe("findOne", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";

    it("should return notification when found", async () => {
      mockNotificationsService.findOne.mockResolvedValue(mockNotification);

      const result = await controller.findOne(validId, mockUser);

      expect(result).toEqual(mockNotification);
      expect(notificationsService.findOne).toHaveBeenCalledWith(
        validId,
        mockUser.id,
        mockUser.companyId,
      );
    });

    it("should throw BadRequestException for invalid UUID", async () => {
      await expect(
        controller.findOne("invalid-uuid", mockUser),
      ).rejects.toThrow(BadRequestException);
      expect(notificationsService.findOne).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when service throws", async () => {
      mockNotificationsService.findOne.mockRejectedValue(
        new NotFoundException("Notification not found"),
      );

      await expect(
        controller.findOne(validId, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("markAsRead", () => {
    it("should mark as read without ids", async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({ updatedCount: 3 });

      const result = await controller.markAsRead({}, mockUser);

      expect(result).toEqual({ updatedCount: 3 });
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
        undefined,
      );
    });

    it("should mark specific ids", async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({ updatedCount: 2 });

      const result = await controller.markAsRead(
        { ids: ["id-1", "id-2"] },
        mockUser,
      );

      expect(result).toEqual({ updatedCount: 2 });
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
        ["id-1", "id-2"],
      );
    });
  });

  describe("markOneAsRead", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";

    it("should mark one as read and return result", async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({ updatedCount: 1 });

      const result = await controller.markOneAsRead(validId, mockUser);

      expect(result).toEqual({ updatedCount: 1 });
      expect(notificationsService.markAsRead).toHaveBeenCalledWith(
        mockUser.id,
        mockUser.companyId,
        [validId],
      );
    });

    it("should throw BadRequestException for invalid UUID", async () => {
      await expect(
        controller.markOneAsRead("not-uuid", mockUser),
      ).rejects.toThrow(BadRequestException);
      expect(notificationsService.markAsRead).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when nothing updated", async () => {
      mockNotificationsService.markAsRead.mockResolvedValue({ updatedCount: 0 });

      await expect(
        controller.markOneAsRead(validId, mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
