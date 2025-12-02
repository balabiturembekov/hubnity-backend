import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CacheService } from "../cache/cache.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async create(dto: CreateProjectDto, companyId: string) {
    // Validate and sanitize project name
    const sanitizedName = dto.name.trim();
    if (!sanitizedName || sanitizedName.length < 1) {
      throw new BadRequestException("Project name cannot be empty");
    }
    if (sanitizedName.length > 255) {
      throw new BadRequestException("Project name cannot exceed 255 characters");
    }

    // Sanitize description if provided
    const sanitizedDescription = dto.description
      ? dto.description.trim()
      : undefined;
    if (
      sanitizedDescription &&
      sanitizedDescription.length > 5000
    ) {
      throw new BadRequestException(
        "Description cannot exceed 5000 characters",
      );
    }

    // Sanitize clientName if provided
    const sanitizedClientName = dto.clientName
      ? dto.clientName.trim()
      : undefined;
    if (sanitizedClientName && sanitizedClientName.length > 255) {
      throw new BadRequestException(
        "Client name cannot exceed 255 characters",
      );
    }

    // Validate color format if provided
    if (dto.color && !/^#[0-9A-Fa-f]{6}$/.test(dto.color)) {
      throw new BadRequestException(
        "Color must be a valid hex color (e.g., #3b82f6)",
      );
    }

    // Validate budget if provided
    if (dto.budget !== undefined) {
      if (dto.budget < 0) {
        throw new BadRequestException("Budget cannot be negative");
      }
      if (dto.budget > 999999999) {
        throw new BadRequestException(
          "Budget cannot exceed $999,999,999",
        );
      }
    }

    const project = await this.prisma.project.create({
      data: {
        name: sanitizedName,
        description: sanitizedDescription,
        color: dto.color || "#3b82f6",
        clientName: sanitizedClientName,
        budget: dto.budget,
        status: dto.status || "ACTIVE",
        companyId,
      },
    });

    await this.cache.invalidateProjects(companyId);
    await this.cache.invalidateStats(companyId);
    return project;
  }

  async findAll(companyId: string) {
    const cacheKey = `projects:${companyId}:all`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const projects = await this.prisma.project.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        clientName: true,
        budget: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    await this.cache.set(cacheKey, projects, 300);
    return projects;
  }

  async findActive(companyId: string) {
    const cacheKey = `projects:${companyId}:active`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const projects = await this.prisma.project.findMany({
      where: {
        status: "ACTIVE",
        companyId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        color: true,
        clientName: true,
        budget: true,
        status: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    await this.cache.set(cacheKey, projects, 300);
    return projects;
  }

  async findOne(id: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        companyId,
      },
    });

    if (!project) {
      throw new NotFoundException(
        `Project with ID ${id} not found in your company`,
      );
    }

    return project;
  }

  async update(id: string, dto: UpdateProjectDto, companyId: string) {
    // Initial check for existence and companyId
    await this.findOne(id, companyId);

    // Perform update within transaction to ensure atomicity and verify companyId
    const updated = await this.prisma.$transaction(async (tx) => {
      // Verify project exists and belongs to company within transaction
      const currentProject = await tx.project.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!currentProject) {
        throw new NotFoundException(
          `Project with ID ${id} not found in your company`,
        );
      }

      // Validate and sanitize name if provided
      let sanitizedName: string | undefined;
      if (dto.name !== undefined) {
        sanitizedName = dto.name.trim();
        if (!sanitizedName || sanitizedName.length < 1) {
          throw new BadRequestException("Project name cannot be empty");
        }
        if (sanitizedName.length > 255) {
          throw new BadRequestException(
            "Project name cannot exceed 255 characters",
          );
        }
      }

      // Sanitize description if provided
      const sanitizedDescription =
        dto.description !== undefined
          ? dto.description
            ? dto.description.trim()
            : null
          : undefined;

      // Sanitize clientName if provided
      let sanitizedClientName: string | null | undefined;
      if (dto.clientName !== undefined) {
        if (dto.clientName === null || dto.clientName === "") {
          sanitizedClientName = null;
        } else {
          sanitizedClientName = dto.clientName.trim();
          if (sanitizedClientName.length > 255) {
            throw new BadRequestException(
              "Client name cannot exceed 255 characters",
            );
          }
        }
      }

      // Validate color format if provided
      if (dto.color !== undefined) {
        if (dto.color && !/^#[0-9A-Fa-f]{6}$/.test(dto.color)) {
          throw new BadRequestException(
            "Color must be a valid hex color (e.g., #3b82f6)",
          );
        }
      }

      // Validate budget if provided
      if (dto.budget !== undefined) {
        if (dto.budget !== null) {
          if (dto.budget < 0) {
            throw new BadRequestException("Budget cannot be negative");
          }
          if (dto.budget > 999999999) {
            throw new BadRequestException(
              "Budget cannot exceed $999,999,999",
            );
          }
        }
      }

      const updateData: any = {};
      if (sanitizedName !== undefined) {
        updateData.name = sanitizedName;
      }
      if (sanitizedDescription !== undefined) {
        updateData.description = sanitizedDescription;
      }
      if (sanitizedClientName !== undefined) {
        updateData.clientName = sanitizedClientName;
      }
      if (dto.color !== undefined) {
        updateData.color = dto.color;
      }
      if (dto.budget !== undefined) {
        updateData.budget = dto.budget;
      }
      if (dto.status !== undefined) {
        updateData.status = dto.status;
      }

      // Check for active time entries if trying to archive
      if (dto.status === "ARCHIVED" && currentProject.status !== "ARCHIVED") {
        const activeEntries = await tx.timeEntry.findMany({
          where: {
            projectId: id,
            status: {
              in: ["RUNNING", "PAUSED"],
            },
            user: {
              companyId,
            },
          },
        });

        if (activeEntries.length > 0) {
          throw new BadRequestException(
            `Cannot archive project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? "s" : ""}).`,
          );
        }
      }

      return tx.project.update({
        where: { id },
        data: updateData,
      });
    });

    await this.cache.invalidateProjects(companyId);
    await this.cache.invalidateStats(companyId);
    return updated;
  }

  async remove(id: string, companyId: string) {
    // Initial check for existence and companyId
    await this.findOne(id, companyId);

    // Perform deletion within transaction to ensure atomicity and verify companyId
    const deleted = await this.prisma.$transaction(async (tx) => {
      // Verify project exists and belongs to company within transaction
      const currentProject = await tx.project.findFirst({
        where: {
          id,
          companyId,
        },
      });

      if (!currentProject) {
        throw new NotFoundException(
          `Project with ID ${id} not found in your company`,
        );
      }

      // Check for active time entries
      const activeEntries = await tx.timeEntry.findMany({
        where: {
          projectId: id,
          status: {
            in: ["RUNNING", "PAUSED"],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntries.length > 0) {
        throw new BadRequestException(
          `Cannot delete project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? "s" : ""}).`,
        );
      }

      return tx.project.delete({
        where: { id },
      });
    });

    await this.cache.invalidateProjects(companyId);
    await this.cache.invalidateStats(companyId);
    return deleted;
  }
}
