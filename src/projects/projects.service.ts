import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

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
      throw new BadRequestException('Project name cannot be empty');
    }

    // Sanitize description if provided
    const sanitizedDescription = dto.description ? dto.description.trim() : undefined;

    const project = await this.prisma.project.create({
      data: {
        ...dto,
        name: sanitizedName,
        description: sanitizedDescription,
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
      orderBy: { createdAt: 'desc' },
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
        status: 'ACTIVE',
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
      orderBy: { createdAt: 'desc' },
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
      throw new NotFoundException(`Project with ID ${id} not found in your company`);
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
        throw new NotFoundException(`Project with ID ${id} not found in your company`);
      }

      // Validate and sanitize name if provided
      let sanitizedName: string | undefined;
      if (dto.name) {
        sanitizedName = dto.name.trim();
        if (!sanitizedName || sanitizedName.length < 1) {
          throw new BadRequestException('Project name cannot be empty');
        }
      }

      // Sanitize description if provided
      const sanitizedDescription = dto.description !== undefined 
        ? (dto.description ? dto.description.trim() : null)
        : undefined;

      const updateData: any = { ...dto };
      if (sanitizedName) {
        updateData.name = sanitizedName;
      }
      if (sanitizedDescription !== undefined) {
        updateData.description = sanitizedDescription;
      }

      // Check for active time entries if trying to archive
      if (dto.status === 'ARCHIVED') {
        const activeEntries = await tx.timeEntry.findMany({
          where: {
            projectId: id,
            status: {
              in: ['RUNNING', 'PAUSED'],
            },
            user: {
              companyId,
            },
          },
        });

        if (activeEntries.length > 0) {
          throw new BadRequestException(
            `Cannot archive project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
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
        throw new NotFoundException(`Project with ID ${id} not found in your company`);
      }

      // Check for active time entries
      const activeEntries = await tx.timeEntry.findMany({
        where: {
          projectId: id,
          status: {
            in: ['RUNNING', 'PAUSED'],
          },
          user: {
            companyId,
          },
        },
      });

      if (activeEntries.length > 0) {
        throw new BadRequestException(
          `Cannot delete project with active time entries. Please stop all running/paused timers associated with this project first (${activeEntries.length} active timer${activeEntries.length > 1 ? 's' : ''}).`,
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

