import { Test, TestingModule } from "@nestjs/testing";
import { ScreenshotsController } from "./screenshots.controller";
import { ScreenshotsService } from "./screenshots.service";
import { PinoLogger } from "nestjs-pino";

describe("ScreenshotsController", () => {
  let controller: ScreenshotsController;
  let screenshotsService: ScreenshotsService;

  const mockScreenshotsService = {
    upload: jest.fn(),
    findByTimeEntry: jest.fn(),
    delete: jest.fn(),
  };

  const mockLogger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };

  const mockUser = {
    id: "user-id",
    name: "John Doe",
    email: "john@example.com",
    companyId: "company-id",
  };

  const mockScreenshot = {
    id: "screenshot-id",
    timeEntryId: "time-entry-id",
    imageUrl: "/uploads/screenshots/xxx.jpg",
    thumbnailUrl: "/uploads/thumbnails/xxx.jpg",
    timestamp: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScreenshotsController],
      providers: [
        {
          provide: ScreenshotsService,
          useValue: mockScreenshotsService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    controller = module.get<ScreenshotsController>(ScreenshotsController);
    screenshotsService =
      module.get<ScreenshotsService>(ScreenshotsService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("findByTimeEntry", () => {
    const timeEntryId = "time-entry-id";
    const mockScreenshots = [mockScreenshot];

    it("should use default limit 100 when limit not provided", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser);

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        100,
      );
    });

    it("should pass limit to service when provided", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser, "50");

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        50,
      );
    });

    it("should cap limit at 100 when exceeding max (5000)", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser, "5000");

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        100,
      );
    });

    it("should use default 100 when limit is invalid (non-numeric)", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser, "invalid");

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        100,
      );
    });

    it("should use default 100 when limit is zero", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser, "0");

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        100,
      );
    });

    it("should accept limit of 1000 (max)", async () => {
      mockScreenshotsService.findByTimeEntry.mockResolvedValue(mockScreenshots);

      await controller.findByTimeEntry(timeEntryId, mockUser, "1000");

      expect(screenshotsService.findByTimeEntry).toHaveBeenCalledWith(
        timeEntryId,
        mockUser.companyId,
        mockUser.id,
        1000,
      );
    });
  });
});
