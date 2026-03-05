import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ProjectStatus,
  MemberRole,
  Prisma,
  MemberStatus,
} from "@prisma/client";

import {
  CreateProjectDto,
  ProjectResponseDto,
  AddProjectMemberDto,
  UpdateProjectMemberDto,
  ProjectMemberResponseDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
  ProjectTaskResponseDto,
  CreateProjectBudgetDto,
  UpdateProjectBudgetDto,
  ProjectBudgetResponseDto,
  ProjectFilterDto,
  TaskFilterDto,
} from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import {
  EntityNotFoundException,
  PermissionDeniedException,
  DuplicateEntityException,
} from "../exceptions/business.exception";

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  // ==================== ПРЕДОПРЕДЕЛЕННЫЕ СЕЛЕКТЫ ====================
  private readonly userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
  };

  private readonly projectInclude = {
    organization: {
      select: {
        id: true,
        name: true,
        ownerId: true,
      },
    },
    client: {
      select: {
        id: true,
        name: true,
        company: true,
      },
    },
    _count: {
      select: {
        members: true,
        tasks: true,
        timeEntries: true,
      },
    },
    tasks: {
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        dueDate: true,
        assignee: {
          select: this.userSelect,
        },
      },
    },
  };

  private readonly memberInclude = {
    user: { select: this.userSelect },
  };

  private readonly taskInclude = {
    assignee: { select: this.userSelect },
  };

  constructor(private readonly prisma: PrismaService) {}

  // ==================== ПРИВАТНЫЕ МЕТОДЫ ВАЛИДАЦИИ ====================

  /**
   * Проверяет существование организации
   */
  private async validateOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, ownerId: true },
    });

    if (!organization) {
      throw new EntityNotFoundException("Organization", organizationId);
    }

    return organization;
  }

  /**
   * Проверяет существование проекта
   */
  private async validateProjectExists(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!project) {
      throw new EntityNotFoundException("Project", projectId);
    }

    return project;
  }

  /**
   * Проверяет права доступа к проекту
   * @returns Member record если пользователь имеет доступ
   */
  private async validateProjectAccess(
    projectId: string,
    userId: string,
    requiredRoles: MemberRole[] = [],
  ) {
    // Сначала проверяем членство в организации
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        organization: {
          select: { ownerId: true },
        },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!project) {
      throw new EntityNotFoundException("Project", projectId);
    }

    // Проверка 1: Является ли пользователь владельцем организации
    if (project.organization.ownerId === userId) {
      return { role: MemberRole.OWNER }; // Владелец имеет полный доступ
    }

    // Проверка 2: Является ли пользователь участником проекта
    const member = project.members[0];
    if (!member) {
      throw new PermissionDeniedException(
        "You do not have access to this project",
      );
    }

    // Проверка 3: Требуемые роли
    if (
      requiredRoles.length > 0 &&
      !requiredRoles.includes(member.role as MemberRole)
    ) {
      throw new PermissionDeniedException(
        `Required roles: ${requiredRoles.join(", ")}`,
      );
    }

    return member;
  }

  /**
   * Проверяет существование пользователя
   */
  private async validateUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new EntityNotFoundException("User", userId);
    }
  }

  /**
   * Проверяет существование клиента
   */
  private async validateClientExists(
    clientId: string,
    organizationId: string,
  ): Promise<void> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        organizationId,
      },
      select: { id: true },
    });

    if (!client) {
      throw new EntityNotFoundException("Client", clientId);
    }
  }

  /**
   * Проверяет уникальность имени проекта в организации
   */
  private async validateProjectNameUnique(
    name: string,
    organizationId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.project.findFirst({
      where: {
        name,
        organizationId,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new DuplicateEntityException("Project", "name", name);
    }
  }

  /**
   * Проверяет, что пользователь еще не является участником проекта
   */
  private async validateUserNotProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existing) {
      throw new DuplicateEntityException(
        "User",
        "membership",
        `User ${userId} is already a project member`,
      );
    }
  }
  // Создать проект
  async createProject(
    dto: CreateProjectDto,
    currentUserId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Creating project in organization ${dto.organizationId}`);

    // 1. Проверяем существование организации
    const organization = await this.validateOrganizationExists(
      dto.organizationId,
    );

    // 2. Проверяем права (только OWNER, ADMIN или MANAGER могут создавать проекты)
    // Для этого нужно проверить роль пользователя в организации
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: dto.organizationId,
          userId: currentUserId,
        },
      },
    });

    const isOwner = organization.ownerId === currentUserId;
    const isAdmin = member?.role === MemberRole.ADMIN;
    const isManager = member?.role === MemberRole.MANAGER;

    if (!isOwner && !isAdmin && !isManager) {
      throw new PermissionDeniedException(
        "Only owner, admin, or manager can create projects",
      );
    }

    // 3. Проверяем уникальность имени проекта
    await this.validateProjectNameUnique(dto.name, dto.organizationId);

    // 4. Если указан clientId, проверяем что клиент существует в этой организации
    if (dto.clientId) {
      await this.validateClientExists(dto.clientId, dto.organizationId);
    }

    try {
      // 5. Создаем проект
      const project = await this.prisma.project.create({
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status ?? ProjectStatus.ACTIVE,
          billable: dto.billable ?? true,
          hourlyRate: dto.hourlyRate,
          organizationId: dto.organizationId,
          clientId: dto.clientId,
        },
        include: this.projectInclude,
      });

      return this.mapToProjectResponse(project);
    } catch (error) {
      this.logger.error(
        `Failed to create project: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
  // Преобразовать проект в ответ
  private mapToProjectResponse(project: any): any {
    if (!project) return null;

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      dueDate: project.dueDate,
      budget: project.budget,
      currency: project.currency,
      organizationId: project.organizationId,
      clientId: project.clientId,
      organization: project.organization,
      client: project.client,
      tasks: project.tasks || [],
      _count: project._count,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  // Получить проекты
  async getProjects(
    currentUserId: string,
    organizationId?: string,
    filters?: ProjectFilterDto,
  ): Promise<ProjectResponseDto[]> {
    this.logger.log("Fetching projects for user ${currentUserId}");

    const where: Prisma.ProjectWhereInput = {};

    if (organizationId) {
      await this.validateOrganizationAccess(organizationId, currentUserId);
      where.organizationId = organizationId;
    } else {
      where.organization = {
        members: {
          some: {
            userId: currentUserId,
            status: MemberStatus.ACTIVE,
          },
        },
      };
    }

    if (filters) {
      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.clientId) {
        where.clientId = filters.clientId;
      }

      if (filters.billable !== undefined) {
        where.billable = filters.billable;
      }
    }

    try {
      const projects = await this.prisma.project.findMany({
        where,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },

          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },

          _count: {
            select: {
              members: true,
              tasks: true,
              timeEntries: true,
            },
          },
        },
        orderBy: { createdAt: Prisma.SortOrder.desc },
      });

      return projects.map((project) => this.mapToProjectResponse(project));
    } catch (error) {
      this.logger.error(
        "Failed to fetch projects: ${error.message}",
        error.stack,
      );
      throw error;
    }
  }

  async getProjectById(
    projectId: string,
    currentUserId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Fetching project ${projectId} by user ${currentUserId}`);

    await this.validateProjectAccess(projectId, currentUserId);

    const project = await this.validateProjectExists(projectId);

    return this.mapToProjectResponse(project);
  }

  // Обновить проект
  async updateProject(
    projectId: string,
    dto: UpdateProjectDto,
    currentUserId: string,
  ): Promise<ProjectResponseDto> {
    this.logger.log(`Updating project ${projectId} by user ${currentUserId}`);

    const project = await this.validateProjectExists(projectId);

    await this.validateProjectAccess(projectId, currentUserId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
      MemberRole.MANAGER,
    ]);

    if (dto.clientId && dto.clientId !== project.clientId) {
      await this.validateClientExists(dto.clientId, project.organizationId);
    }

    try {
      const updatedProject = await this.prisma.project.update({
        where: { id: projectId },
        data: {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          billable: dto.billable,
          hourlyRate: dto.hourlyRate,
          clientId: dto.clientId,
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              company: true,
            },
          },

          _count: {
            select: {
              members: true,
              tasks: true,
              timeEntries: true,
            },
          },
        },
      });

      return this.mapToProjectResponse(updatedProject);
    } catch (error) {
      this.logger.error(
        `Failed to update project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteProject(projectId: string, currentUserId: string): Promise<void> {
    this.logger.log(`Deleting project ${projectId} by user ${currentUserId}`);

    await this.validateProjectExists(projectId);

    await this.validateProjectAccess(projectId, currentUserId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
    ]);

    try {
      await this.prisma.project.delete({
        where: { id: projectId },
      });

      this.logger.log(`Project ${projectId} deleted successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to delete project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Добавить участника в проект
  async addProjectMember(
    projectId: string,
    dto: AddProjectMemberDto,
    currentUserId: string,
  ): Promise<ProjectMemberResponseDto> {
    this.logger.log(
      `Adding member ${dto.userId} to project ${projectId} by user ${currentUserId}`,
    );
    const project = await this.validateProjectExists(projectId);

    await this.validateProjectAccess(projectId, currentUserId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
      MemberRole.MANAGER,
    ]);

    await this.validateUserExists(dto.userId);

    const organizationMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: dto.userId,
        },
      },

      select: { status: true },
    });

    if (
      !organizationMember ||
      organizationMember.status !== MemberStatus.ACTIVE
    ) {
      throw new PermissionDeniedException(
        "User is not a member of the organization",
      );
    }

    await this.validateUserNotProjectMember(projectId, dto.userId);

    try {
      const member = await this.prisma.projectMember.create({
        data: {
          projectId,
          userId: dto.userId,
          role: dto.role ?? MemberRole.USER,
          joinedAt: new Date(),
        },
        include: {
          user: { select: this.userSelect },
        },
      });

      return this.mapToProjectMemberResponse(member);
    } catch (error) {
      this.logger.error(
        `Failed to add member ${dto.userId} to project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProjectMembers(
    projectId: string,
    currentUserId: string,
  ): Promise<ProjectMemberResponseDto[]> {
    this.logger.log(
      `Fetching members for project ${projectId} by user ${currentUserId}`,
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) {
      throw new EntityNotFoundException("Project", projectId);
    }

    await this.validateOrganizationAccess(
      project.organizationId,
      currentUserId,
    );

    try {
      const members = await this.prisma.projectMember.findMany({
        where: { projectId },
        include: {
          user: { select: this.userSelect },
        },
        orderBy: { joinedAt: Prisma.SortOrder.desc },
      });
      return members.map((member) => this.mapToProjectMemberResponse(member));
    } catch (error) {
      this.logger.error(
        `Failed to fetch members for project ${projectId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProjectMemberById(
    projectId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<ProjectMemberResponseDto> {
    this.logger.log(`Fetching member ${memberId} from project ${projectId}`);

    // Проверяем доступ к проекту
    await this.validateProjectAccess(projectId, currentUserId);

    try {
      const member = await this.prisma.projectMember.findUnique({
        where: { id: memberId },
        include: {
          user: { select: this.userSelect },
          project: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!member || member.projectId !== projectId) {
        throw new EntityNotFoundException("Project member", memberId);
      }

      return this.mapToProjectMemberResponse(member);
    } catch (error) {
      this.logger.error(
        `Failed to fetch project member: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateProjectMember(
    projectId: string,
    memberId: string,
    dto: UpdateProjectMemberDto,
    currentUserId: string,
  ): Promise<ProjectMemberResponseDto> {
    this.logger.log(`Updating member ${memberId} in project ${projectId}`);

    // 1. Проверяем существование участника
    const member = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
      include: {
        project: {
          select: {
            id: true,
            organization: {
              select: { ownerId: true },
            },
          },
        },
        user: {
          select: { id: true },
        },
      },
    });

    if (!member || member.projectId !== projectId) {
      throw new EntityNotFoundException("Project member", memberId);
    }

    // 2. Проверяем права
    const isOwner = member.project.organization.ownerId === currentUserId;
    const isSelf = member.userId === currentUserId;

    let hasPermission = false;

    if (isOwner) {
      // Владелец организации может менять любые роли
      hasPermission = true;
    } else {
      // Проверяем роль текущего пользователя в проекте
      const currentUserMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: currentUserId,
          },
        },
        select: { role: true },
      });

      const isAdmin = currentUserMember?.role === "ADMIN";
      const isManager = currentUserMember?.role === "MANAGER";

      // ADMIN и MANAGER могут менять роли других (кроме владельца)
      hasPermission = (isAdmin || isManager) && !isSelf;
    }

    if (!hasPermission) {
      throw new PermissionDeniedException(
        "You do not have permission to update this member",
      );
    }

    // 3. Обновляем роль
    try {
      const updatedMember = await this.prisma.projectMember.update({
        where: { id: memberId },
        data: {
          role: dto.role,
        },
        include: {
          user: { select: this.userSelect },
        },
      });

      return this.mapToProjectMemberResponse(updatedMember);
    } catch (error) {
      this.logger.error(
        `Failed to update project member: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeProjectMember(
    projectId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<void> {
    this.logger.log(`Removing member ${memberId} from project ${projectId}`);

    // 1. Проверяем существование участника
    const member = await this.prisma.projectMember.findUnique({
      where: { id: memberId },
      include: {
        project: {
          select: {
            id: true,
            organization: {
              select: { ownerId: true },
            },
          },
        },
      },
    });

    if (!member || member.projectId !== projectId) {
      throw new EntityNotFoundException("Project member", memberId);
    }

    // 2. Нельзя удалить самого себя? (можно, но осторожно)
    // Раскомментируй если хочешь запретить
    // if (member.userId === currentUserId) {
    //   throw new InvalidOperationException('You cannot remove yourself from the project');
    // }

    // 3. Проверяем права
    const isOwner = member.project.organization.ownerId === currentUserId;
    const isSelf = member.userId === currentUserId;

    let hasPermission = false;

    if (isOwner) {
      // Владелец организации может удалять любых участников
      hasPermission = true;
    } else if (isSelf) {
      // Пользователь может удалить сам себя
      hasPermission = true;
    } else {
      // Проверяем роль текущего пользователя в проекте
      const currentUserMember = await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: currentUserId,
          },
        },
        select: { role: true },
      });

      const isAdmin = currentUserMember?.role === "ADMIN";
      const isManager = currentUserMember?.role === "MANAGER";

      // ADMIN и MANAGER могут удалять других
      hasPermission = isAdmin || isManager;
    }

    if (!hasPermission) {
      throw new PermissionDeniedException(
        "You do not have permission to remove this member",
      );
    }

    try {
      await this.prisma.projectMember.delete({
        where: { id: memberId },
      });

      this.logger.log(`Member ${memberId} removed from project ${projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to remove project member: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Проверить доступ к организации
  private async validateOrganizationAccess(
    organizationId: string,
    currentUserId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
      select: { status: true },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new PermissionDeniedException(
        "You do not have access to this organization or your membership is not active",
      );
    }
  }

  private mapToProjectMemberResponse(member: any): ProjectMemberResponseDto {
    return {
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt,
      projectId: member.projectId,
      userId: member.userId,
      user: member.user,
    };
  }
}
