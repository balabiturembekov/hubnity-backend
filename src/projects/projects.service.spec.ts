import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";

describe("ProjectsService", () => {
  let service: ProjectsService;

  const mockPrismaService = {
    project: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    timeEntry: {
      findMany: jest.fn(),
    },
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    invalidateProjects: jest.fn(),
    invalidateStats: jest.fn(),
  };

  const mockProject = {
    id: "project-id",
    name: "Test Project",
    budget: 10000,
    companyId: "company-id",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getBudgetStatus", () => {
    const companyId = "company-id";

    it("should return budget status with used and remaining", async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject);
      mockPrismaService.timeEntry.findMany.mockResolvedValue([
        {
          duration: 7200,
          user: { hourlyRate: 50 },
        },
        {
          duration: 3600,
          user: { hourlyRate: 100 },
        },
      ]);

      const result = await service.getBudgetStatus(mockProject.id, companyId);

      expect(result).toMatchObject({
        projectId: mockProject.id,
        projectName: mockProject.name,
        budget: 10000,
        used: 200,
        remaining: 9800,
        usedPercent: 2,
        entriesCount: 2,
      });
    });

    it("should return message when project has no budget", async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        ...mockProject,
        budget: null,
      });

      const result = await service.getBudgetStatus(mockProject.id, companyId);

      expect(result).toMatchObject({
        projectId: mockProject.id,
        projectName: mockProject.name,
        budget: null,
        used: null,
        remaining: null,
        usedPercent: null,
        message: "Project has no budget set",
      });
    });

    it("should throw NotFoundException when project not found", async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getBudgetStatus("unknown-id", companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
