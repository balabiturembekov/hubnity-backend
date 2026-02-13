import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ScreenshotsService } from "./screenshots.service";
import { PrismaService } from "../prisma/prisma.service";
import { PinoLogger } from "nestjs-pino";

describe("ScreenshotsService", () => {
  let service: ScreenshotsService;

  const mockPrismaService = {
    $transaction: jest.fn(),
    screenshot: {
      findMany: jest.fn(),
    },
  };

  const mockLogger = {
    setContext: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
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
      providers: [
        ScreenshotsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<ScreenshotsService>(ScreenshotsService);

    jest.clearAllMocks();

    mockPrismaService.$transaction.mockImplementation(async (callback) => {
      const tx = {
        timeEntry: {
          findFirst: jest.fn().mockResolvedValue({
            id: "time-entry-id",
            userId: "user-id",
            user: { companyId: "company-id" },
          }),
        },
        user: {
          findFirst: jest.fn().mockResolvedValue({ id: "user-id" }),
        },
      };
      return callback(tx);
    });
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("findByTimeEntry", () => {
    const timeEntryId = "time-entry-id";
    const companyId = "company-id";
    const userId = "user-id";

    it("should use default limit 100 when not provided", async () => {
      mockPrismaService.screenshot.findMany.mockResolvedValue([mockScreenshot]);

      await service.findByTimeEntry(timeEntryId, companyId, userId);

      expect(mockPrismaService.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { timeEntryId },
          take: 100,
          orderBy: { timestamp: "desc" },
        }),
      );
    });

    it("should pass custom limit to findMany", async () => {
      mockPrismaService.screenshot.findMany.mockResolvedValue([mockScreenshot]);

      await service.findByTimeEntry(timeEntryId, companyId, userId, 50);

      expect(mockPrismaService.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { timeEntryId },
          take: 50,
        }),
      );
    });

    it("should pass limit 1000 when max value provided", async () => {
      mockPrismaService.screenshot.findMany.mockResolvedValue([mockScreenshot]);

      await service.findByTimeEntry(timeEntryId, companyId, userId, 1000);

      expect(mockPrismaService.screenshot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });

    it("should throw NotFoundException when time entry not found", async () => {
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          timeEntry: {
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(
        service.findByTimeEntry(timeEntryId, companyId, userId, 100),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrismaService.screenshot.findMany).not.toHaveBeenCalled();
    });
  });
});
