// services/organization.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MemberRole, MemberStatus, Prisma } from "@prisma/client";

import { CreateOrganizationDto } from "./dto/create-organization-dto";
import { UpdateOrganizationDto } from "./dto/update-organization-dto";
import { OrganizationResponseDto } from "./dto/organization-response.dto";
import {
  OrganizationMemberResponseDto,
  UpdateOrganizationMemberDto,
  AddOrganizationMemberDto,
} from "./dto/organization-member.dto";
import {
  HolidayResponseDto,
  CreateHolidayDto,
  UpdateHolidayDto,
} from "./dto/holiday.dto";
import {
  EntityNotFoundException,
  PermissionDeniedException,
  DuplicateEntityException,
  InvalidOperationException,
} from "../exceptions/business.exception";

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  // Предопределенные селекты для повторного использования
  private readonly userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true,
  } as const;

  private readonly memberInclude = {
    user: { select: this.userSelect },
    invitedBy: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    // Здесь можно добавить логгер, кэш, события и т.д.
  ) {}

  // ==================== PRIVATE VALIDATION METHODS ====================

  /**
   * Проверяет, существует ли пользователь с указанным ID
   * @throws EntityNotFoundException если пользователь не найден
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
   * Проверяет, существует ли организация с указанным ID
   * @returns Организация, если найдена
   * @throws EntityNotFoundException если организация не найдена
   */
  private async validateOrganizationExists(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new EntityNotFoundException("Organization", organizationId);
    }

    return organization;
  }

  /**
   * Проверяет права доступа пользователя к организации
   * @returns Member record если пользователь имеет доступ
   * @throws PermissionDeniedException если нет доступа
   */
  private async validateMemberAccess(
    organizationId: string,
    userId: string,
    requiredRoles: MemberRole[] = [],
  ) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new PermissionDeniedException(
        "You do not have access to this organization or your membership is not active",
      );
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(member.role)) {
      throw new PermissionDeniedException(
        `Required roles: ${requiredRoles.join(", ")}`,
      );
    }

    return member;
  }

  /**
   * Проверяет, является ли пользователь владельцем организации
   */
  private async validateIsOwner(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });

    if (!organization) {
      throw new EntityNotFoundException("Organization", organizationId);
    }

    if (organization.ownerId !== userId) {
      throw new PermissionDeniedException(
        "Only organization owner can perform this action",
      );
    }
  }

  /**
   * Проверяет уникальность имени организации
   */
  private async validateOrganizationNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.organization.findFirst({
      where: {
        name,
        ...(excludeId && { NOT: { id: excludeId } }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new DuplicateEntityException("Organization", "name", name);
    }
  }

  /**
   * Проверяет, что пользователь еще не является членом организации
   */
  private async validateUserNotMember(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    if (existing) {
      throw new DuplicateEntityException(
        "User",
        "membership",
        `User ${userId} is already a member`,
      );
    }
  }

  // ==================== ORGANIZATION CRUD ====================

  /**
   * Создает новую организацию и автоматически добавляет владельца как участника
   */
  async createOrganization(
    dto: CreateOrganizationDto,
    currentUserId: string,
  ): Promise<OrganizationResponseDto> {
    this.logger.log(`Creating organization for user ${currentUserId}`);

    // 1. Валидация прав
    if (dto.ownerId !== currentUserId) {
      throw new PermissionDeniedException(
        "You can only create organizations for yourself",
      );
    }

    // 2. Проверка существования пользователя
    await this.validateUserExists(dto.ownerId);

    // 3. Проверка уникальности имени
    await this.validateOrganizationNameUnique(dto.name);

    try {
      // 4. Используем транзакцию для атомарности
      const organization = await this.prisma.$transaction(async (tx) => {
        // Создаем организацию
        const org = await tx.organization.create({
          data: {
            name: dto.name,
            ownerId: dto.ownerId,
            settings: dto.settings ?? {},
            timezone: dto.timezone ?? "UTC",
            currency: dto.currency ?? "USD",
          },
        });

        // Создаем членство для владельца
        await tx.organizationMember.create({
          data: {
            organizationId: org.id,
            userId: dto.ownerId,
            role: MemberRole.OWNER,
            status: MemberStatus.ACTIVE,
            joinedAt: new Date(),
            invitedById: dto.ownerId,
            settings: {},
          },
        });

        // Возвращаем организацию с участниками
        return tx.organization.findUnique({
          where: { id: org.id },
          include: {
            members: {
              include: this.memberInclude,
            },
            _count: {
              select: {
                projects: true,
                clients: true,
                members: true,
              },
            },
          },
        });
      });

      return this.mapToOrganizationResponse(organization);
    } catch (error) {
      this.logger.error(
        `Failed to create organization: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Получает все организации, доступные пользователю
   */
  async getUserOrganizations(
    userId: string,
  ): Promise<OrganizationResponseDto[]> {
    this.logger.log(`Fetching organizations for user ${userId}`);

    const organizations = await this.prisma.organization.findMany({
      where: {
        members: {
          some: {
            userId,
            status: MemberStatus.ACTIVE,
          },
        },
      },
      include: {
        members: {
          where: { status: MemberStatus.ACTIVE },
          include: this.memberInclude,
          take: 5, // Ограничиваем количество возвращаемых участников
        },
        _count: {
          select: {
            projects: true,
            clients: true,
            members: {
              where: { status: MemberStatus.ACTIVE },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return organizations.map((org) => this.mapToOrganizationResponse(org));
  }

  /**
   * Получает детальную информацию об организации
   */
  async getOrganizationById(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    this.logger.log(
      `Fetching organization ${organizationId} for user ${userId}`,
    );

    // 1. Проверяем доступ
    await this.validateMemberAccess(organizationId, userId);

    // 2. Получаем организацию с полными данными
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: this.memberInclude,
          orderBy: [{ role: "asc" }, { user: { firstName: "asc" } }],
        },
        projects: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
        clients: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
          },
        },
        holidays: {
          orderBy: { date: "asc" },
        },
        _count: {
          select: {
            projects: true,
            clients: true,
            members: true,
            invites: true,
          },
        },
      },
    });

    if (!organization) {
      throw new EntityNotFoundException("Organization", organizationId);
    }

    return this.mapToOrganizationResponse(organization);
  }

  /**
   * Обновляет информацию об организации
   */
  async updateOrganization(
    organizationId: string,
    dto: UpdateOrganizationDto,
    userId: string,
  ): Promise<OrganizationResponseDto> {
    this.logger.log(
      `Updating organization ${organizationId} by user ${userId}`,
    );

    // 1. Проверяем, что организация существует
    await this.validateOrganizationExists(organizationId);

    // 2. Проверяем права (только OWNER или ADMIN)
    const member = await this.validateMemberAccess(organizationId, userId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
    ]);

    // 3. Если обновляется имя, проверяем уникальность
    if (dto.name) {
      await this.validateOrganizationNameUnique(dto.name, organizationId);
    }

    // 4. Обновляем организацию
    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        settings: dto.settings,
        timezone: dto.timezone,
        currency: dto.currency,
      },
      include: {
        members: {
          include: this.memberInclude,
          take: 5,
        },
        _count: {
          select: {
            projects: true,
            clients: true,
            members: true,
          },
        },
      },
    });

    return this.mapToOrganizationResponse(updated);
  }

  /**
   * Удаляет организацию (только владелец)
   */
  async deleteOrganization(
    organizationId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Deleting organization ${organizationId} by user ${userId}`,
    );

    // 1. Проверяем, что пользователь является владельцем
    await this.validateIsOwner(organizationId, userId);

    try {
      // Каскадное удаление настроено в схеме
      await this.prisma.organization.delete({
        where: { id: organizationId },
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete organization: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * Добавляет нового участника в организацию
   */
  async addMember(
    organizationId: string,
    dto: AddOrganizationMemberDto,
    currentUserId: string,
  ): Promise<OrganizationMemberResponseDto> {
    this.logger.log(
      `Adding member ${dto.userId} to organization ${organizationId}`,
    );

    // 1. Проверяем существование организации
    await this.validateOrganizationExists(organizationId);

    // 2. Проверяем права (OWNER, ADMIN или MANAGER могут добавлять участников)
    await this.validateMemberAccess(organizationId, currentUserId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
      MemberRole.MANAGER,
    ]);

    // 3. Проверяем существование добавляемого пользователя
    await this.validateUserExists(dto.userId);

    // 4. Проверяем, что пользователь еще не участник
    await this.validateUserNotMember(organizationId, dto.userId);

    // 5. Нельзя добавить владельца как обычного участника
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { ownerId: true },
    });

    if (organization?.ownerId === dto.userId) {
      throw new InvalidOperationException(
        "Owner is already a member with OWNER role",
      );
    }

    // 6. Создаем участника
    const member = await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId: dto.userId,
        role: dto.role ?? MemberRole.USER,
        status: dto.status ?? MemberStatus.PENDING,
        hourlyRate: dto.hourlyRate,
        weeklyLimit: dto.weeklyLimit,
        settings: dto.settings ?? {},
        invitedById: dto.invitedById ?? currentUserId,
        invitedAt: new Date(),
      },
      include: this.memberInclude,
    });

    return this.mapToMemberResponse(member);
  }

  /**
   * Получает всех участников организации
   */
  async getMembers(
    organizationId: string,
    userId: string,
    filters?: { role?: MemberRole; status?: MemberStatus },
  ): Promise<OrganizationMemberResponseDto[]> {
    this.logger.log(`Fetching members for organization ${organizationId}`);

    // Проверяем доступ
    await this.validateMemberAccess(organizationId, userId);

    const where: Prisma.OrganizationMemberWhereInput = {
      organizationId,
      is_current: true,
      ...(filters?.role && { role: filters.role }),
      ...(filters?.status && { status: filters.status }),
    };

    const members = await this.prisma.organizationMember.findMany({
      where,
      include: this.memberInclude,
      orderBy: [{ role: "asc" }, { user: { firstName: "asc" } }],
    });

    return members.map((member) => this.mapToMemberResponse(member));
  }

  /**
   * Обновляет информацию об участнике
   */
  async updateMember(
    organizationId: string,
    memberId: string,
    dto: UpdateOrganizationMemberDto,
    currentUserId: string,
  ): Promise<OrganizationMemberResponseDto> {
    this.logger.log(
      `Updating member ${memberId} in organization ${organizationId}`,
    );

    // 1. Находим членство
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { organization: { select: { ownerId: true } } },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new EntityNotFoundException("Member", memberId);
    }

    // 2. Проверяем права
    const currentMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
    });

    const isOwner = member.organization.ownerId === currentUserId;
    const isAdmin = currentMember?.role === MemberRole.ADMIN;
    const isSelf = currentUserId === member.userId;

    if (!isOwner && !isAdmin && !isSelf) {
      throw new PermissionDeniedException("You cannot update this member");
    }

    // 3. Нельзя изменить роль владельца
    if (
      member.role === MemberRole.OWNER &&
      dto.role &&
      dto.role !== MemberRole.OWNER
    ) {
      throw new InvalidOperationException("Cannot change owner role");
    }

    // 4. Обновляем
    const updated = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: dto,
      include: this.memberInclude,
    });

    return this.mapToMemberResponse(updated);
  }

  /**
   * Удаляет участника из организации (мягкое удаление через is_current)
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    currentUserId: string,
  ): Promise<void> {
    this.logger.log(
      `Removing member ${memberId} from organization ${organizationId}`,
    );

    // 1. Находим членство
    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { organization: { select: { ownerId: true } } },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new EntityNotFoundException("Member", memberId);
    }

    // 2. Нельзя удалить владельца
    if (member.role === MemberRole.OWNER) {
      throw new InvalidOperationException("Cannot remove the owner");
    }

    // 3. Проверяем права
    const currentMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
    });

    const isOwner = member.organization.ownerId === currentUserId;
    const isAdmin = currentMember?.role === MemberRole.ADMIN;
    const isSelf = currentUserId === member.userId;

    if (!isOwner && !isAdmin && !isSelf) {
      throw new PermissionDeniedException("You cannot remove this member");
    }

    // 4. Мягкое удаление через SCD Type 2
    await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: {
        is_current: false,
        valid_to: new Date(),
        status: MemberStatus.INACTIVE,
      },
    });
  }

  // ==================== HOLIDAY MANAGEMENT ====================

  /**
   * Добавляет праздничный день для организации
   */
  async addHoliday(
    organizationId: string,
    dto: CreateHolidayDto,
    userId: string,
  ): Promise<HolidayResponseDto> {
    this.logger.log(`Adding holiday to organization ${organizationId}`);

    // Проверяем права (только ADMIN и выше)
    await this.validateMemberAccess(organizationId, userId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
    ]);

    try {
      const holiday = await this.prisma.holiday.create({
        data: {
          name: dto.name,
          date: dto.date,
          recurring: dto.recurring ?? false,
          organizationId,
        },
      });

      return this.mapToHolidayResponse(holiday);
    } catch (error) {
      if (error.code === "P2002") {
        throw new DuplicateEntityException(
          "Holiday",
          "date",
          dto.date.toISOString(),
        );
      }
      throw error;
    }
  }

  /**
   * Получает все праздники организации
   */
  async getHolidays(
    organizationId: string,
    userId: string,
    year?: number,
  ): Promise<HolidayResponseDto[]> {
    this.logger.log(`Fetching holidays for organization ${organizationId}`);

    // Проверяем доступ
    await this.validateMemberAccess(organizationId, userId);

    const where: Prisma.HolidayWhereInput = { organizationId };

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);
      where.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    const holidays = await this.prisma.holiday.findMany({
      where,
      orderBy: { date: "asc" },
    });

    return holidays.map((holiday) => this.mapToHolidayResponse(holiday));
  }

  /**
   * Обновляет праздничный день
   */
  async updateHoliday(
    organizationId: string,
    holidayId: string,
    dto: UpdateHolidayDto,
    userId: string,
  ): Promise<HolidayResponseDto> {
    this.logger.log(`Updating holiday ${holidayId}`);

    // Проверяем права
    await this.validateMemberAccess(organizationId, userId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
    ]);

    const holiday = await this.prisma.holiday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday || holiday.organizationId !== organizationId) {
      throw new EntityNotFoundException("Holiday", holidayId);
    }

    const updated = await this.prisma.holiday.update({
      where: { id: holidayId },
      data: dto,
    });

    return this.mapToHolidayResponse(updated);
  }

  /**
   * Удаляет праздничный день
   */
  async deleteHoliday(
    organizationId: string,
    holidayId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(`Deleting holiday ${holidayId}`);

    // Проверяем права
    await this.validateMemberAccess(organizationId, userId, [
      MemberRole.OWNER,
      MemberRole.ADMIN,
    ]);

    const holiday = await this.prisma.holiday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday || holiday.organizationId !== organizationId) {
      throw new EntityNotFoundException("Holiday", holidayId);
    }

    await this.prisma.holiday.delete({
      where: { id: holidayId },
    });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Проверяет, имеет ли пользователь определенную роль в организации
   */
  async hasRole(
    organizationId: string,
    userId: string,
    role: MemberRole,
  ): Promise<boolean> {
    try {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        select: { role: true, status: true },
      });

      return member?.status === MemberStatus.ACTIVE && member.role === role;
    } catch {
      return false;
    }
  }

  /**
   * Получает статистику по организации
   */
  async getOrganizationStats(
    organizationId: string,
    userId: string,
  ): Promise<any> {
    this.logger.log(`Fetching stats for organization ${organizationId}`);

    await this.validateMemberAccess(organizationId, userId);

    const [
      totalMembers,
      activeMembers,
      totalProjects,
      activeProjects,
      totalClients,
      timeEntriesLast30Days,
    ] = await Promise.all([
      this.prisma.organizationMember.count({
        where: { organizationId, is_current: true },
      }),
      this.prisma.organizationMember.count({
        where: {
          organizationId,
          is_current: true,
          status: MemberStatus.ACTIVE,
        },
      }),
      this.prisma.project.count({ where: { organizationId } }),
      this.prisma.project.count({
        where: { organizationId, status: "ACTIVE" },
      }),
      this.prisma.client.count({ where: { organizationId } }),
      this.prisma.timeEntry.count({
        where: {
          project: { organizationId },
          startTime: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      members: { total: totalMembers, active: activeMembers },
      projects: { total: totalProjects, active: activeProjects },
      clients: totalClients,
      timeEntries: { last30Days: timeEntriesLast30Days },
    };
  }

  // ==================== PRIVATE MAPPERS ====================

  private mapToOrganizationResponse(org: any): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name,
      ownerId: org.ownerId,
      settings: org.settings,
      timezone: org.timezone,
      currency: org.currency,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      membersCount: org._count?.members ?? org.members?.length,
      projectsCount: org._count?.projects,
      clientsCount: org._count?.clients,
    };
  }

  private mapToMemberResponse(member: any): OrganizationMemberResponseDto {
    return {
      id: member.id,
      role: member.role,
      status: member.status,
      hourlyRate: member.hourlyRate,
      weeklyLimit: member.weeklyLimit,
      joinedAt: member.joinedAt,
      invitedAt: member.invitedAt,
      settings: member.settings,
      organizationId: member.organizationId,
      userId: member.userId,
      invitedById: member.invitedById,
      createdAt: member.createdAt,
      user: member.user,
      invitedBy: member.invitedBy,
    };
  }

  private mapToHolidayResponse(holiday: any): HolidayResponseDto {
    return {
      id: holiday.id,
      name: holiday.name,
      date: holiday.date,
      recurring: holiday.recurring,
      organizationId: holiday.organizationId,
    };
  }
}
