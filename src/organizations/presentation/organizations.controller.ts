import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Inject,
  ForbiddenException,
  Delete,
  NotFoundException,
} from "@nestjs/common";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { GetUser } from "@/auth/decorators/get-user.decorator";
import { CreateOrganizationUseCase } from "@/organizations/application/use-cases/create-organization.usecase";
import { UpdateOrganizationUseCase } from "@/organizations/application/use-cases/update-orgaanization.usecase";
import { GetOrganizationMembersUseCase } from "@/organizations/application/use-cases/get-organization-members.usecase";
import { AddMemberUseCase } from "@/organizations/application/use-cases/add-member.usecase";
import { IOrganizationRepository } from "../domain/repositories/organization.repository.interface";
import { OrganizationRole } from "@prisma/client";
import { UpdateMemberRoleUseCase } from "../application/use-cases/update-member-role.usecase";
import { OrganizationResponseDto } from "./dto/organization-response.dto";

@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly createUseCase: CreateOrganizationUseCase,
    private readonly updateUseCase: UpdateOrganizationUseCase,
    private readonly getMembersUseCase: GetOrganizationMembersUseCase,
    private readonly addMemberUseCase: AddMemberUseCase,
    private readonly updateRoleUseCase: UpdateMemberRoleUseCase,
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  @Post()
  async create(@Body() dto: { name: string }, @GetUser("id") userId: string) {
    return this.createUseCase.execute(dto.name, userId);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body()
    dto: {
      name?: string;
      interval?: number;
      blur?: boolean;
      idleTimeout?: number;
    },
    @GetUser("id") userId: string,
  ) {
    return this.updateUseCase.execute(id, userId, dto);
  }

  @Get(":id")
  async getById(@Param("id") id: string) {
    const org = await this.orgRepo.findById(id);
    if (!org) throw new NotFoundException("Organization not found");
    return OrganizationResponseDto.fromDomain(org);
  }

  @Get(":id/members")
  async getMembers(@Param("id") id: string, @GetUser("id") userId: string) {
    return this.getMembersUseCase.execute(id, userId);
  }

  @Post(":id/members")
  async addMember(
    @Param("id") id: string,
    @Body() dto: { targetUserId: string; role: OrganizationRole },
    @GetUser("id") userId: string,
  ) {
    return this.addMemberUseCase.execute(
      id,
      userId,
      dto.targetUserId,
      dto.role,
    );
  }

  @Patch(":id/members/:targetUserId/role")
  async updateRole(
    @Param("id") id: string,
    @Param("targetUserId") targetUserId: string,
    @Body("role") role: OrganizationRole,
    @GetUser("id") userId: string,
  ) {
    return this.updateRoleUseCase.execute(id, userId, targetUserId, role);
  }

  // 7. Удалить участника (Уволить)
  @Delete(":id/members/:targetUserId")
  async removeMember(
    @Param("id") id: string,
    @Param("targetUserId") targetUserId: string,
    @GetUser("id") userId: string,
  ) {
    // Проверка прав: только OWNER может удалять
    const requester = await this.orgRepo.findMember(userId, id);
    if (!requester || requester.role !== "OWNER") {
      throw new ForbiddenException("Only the owner can remove members");
    }

    await this.orgRepo.removeMember(targetUserId, id);
    return { success: true };
  }
}
