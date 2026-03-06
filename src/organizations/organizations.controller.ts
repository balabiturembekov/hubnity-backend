import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { OrganizationService } from "./organizations.service";
import {
  CreateOrganizationDto,
  OrganizationStatsResponseDto,
} from "./dto/create-organization-dto";
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UpdateOrganizationDto } from "./dto/update-organization-dto";
import { OrganizationResponseDto } from "./dto/organization-response.dto";
import { GetUser } from "@/auth/decorators/get-user.decorator";
import { MemberRole, MemberStatus } from "@prisma/client";
import {
  HolidayResponseDto,
  CreateHolidayDto,
  UpdateHolidayDto,
  HolidayFilterDto,
} from "./dto/holiday.dto";
import {
  AddOrganizationMemberDto,
  MemberFilterDto,
  OrganizationMemberResponseDto,
  UpdateOrganizationMemberDto,
} from "./dto/organization-member.dto";
import {
  AddOrganizationGoalsDto,
} from "./dto/organization-goals.dto";
import {
  OrganizationGoalItemDto,
} from "./dto/organization-response.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private organizationService: OrganizationService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new organization",
    description:
      "Creates organization and adds owner as member. Optionally send email invitations (invitedUsers) and/or create invite links (inviteLinks). When inviteLinks is provided, response is { organization, inviteLinks }.",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description:
      "Organization created. If inviteLinks was sent in the request, response is { organization, inviteLinks }.",
    type: OrganizationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Organization name already exists",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(
    @GetUser("id") userId: string,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationService.createOrganization(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: "Get all organizations for current user" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organizations retrieved successfully",
    type: [OrganizationResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "User not found",
  })
  async getUserOrganizations(@GetUser("id") currentUserId: string) {
    return this.organizationService.getUserOrganizations(currentUserId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get organization by ID" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization retrieved successfully",
    type: OrganizationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getOrganizationById(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.getOrganizationByIdForUser(
      organizationId,
      currentUserId,
    );
  }

  @Put(":id")
  @ApiOperation({ summary: "Update organization" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization updated successfully",
    type: OrganizationResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  async updateOrganization(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() dto: UpdateOrganizationDto,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationResponseDto> {
    return this.organizationService.updateOrganization(
      organizationId,
      dto,
      currentUserId,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete organization" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Organization deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Only owner can delete organization",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrganization(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<void> {
    await this.organizationService.deleteOrganization(
      organizationId,
      currentUserId,
    );
  }

  // ==================== MEMBER ENDPOINTS ====================

  @Post(":id/members")
  @ApiOperation({ summary: "Add member to organization" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Member added successfully",
    type: OrganizationMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization or user not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "User is already a member",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() addMemberDto: AddOrganizationMemberDto,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationMemberResponseDto> {
    return this.organizationService.addMember(
      organizationId,
      addMemberDto,
      currentUserId,
    );
  }

  @Get(":id/goals")
  @ApiOperation({
    summary: "Get organization goals",
    description:
      "Returns the goals assigned to this organization (from the global goals catalog).",
  })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Organization goals",
    type: [OrganizationGoalItemDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getOrganizationGoals(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @GetUser("id") currentUserId: string,
  ) {
    return this.organizationService.getOrganizationGoals(
      organizationId,
      currentUserId,
    );
  }

  @Post(":id/goals")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Add goals to organization",
    description:
      "Add goals (from the global catalog) to the organization. OWNER, ADMIN, or MANAGER only.",
  })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Goals added; returns updated list of organization goals",
    type: [OrganizationGoalItemDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization or one of the goals not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async addGoalsToOrganization(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() dto: AddOrganizationGoalsDto,
    @GetUser("id") currentUserId: string,
  ) {
    return this.organizationService.addGoalsToOrganization(
      organizationId,
      dto,
      currentUserId,
    );
  }

  @Delete(":id/goals/:goalId")
  @ApiOperation({
    summary: "Remove goal from organization",
    description:
      "Disconnects a goal from the organization. OWNER, ADMIN, or MANAGER only.",
  })
  @ApiParam({ name: "id", description: "Organization ID" })
  @ApiParam({ name: "goalId", description: "Organization goal ID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Goal removed from organization",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Goal is not assigned to this organization",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async removeGoalFromOrganization(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("goalId", ParseUUIDPipe) goalId: string,
    @GetUser("id") currentUserId: string,
  ) {
    await this.organizationService.removeGoalFromOrganization(
      organizationId,
      goalId,
      currentUserId,
    );
  }

  @Get(":id/members")
  @ApiOperation({ summary: "Get all organization members" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiQuery({
    name: "role",
    enum: MemberRole,
    required: false,
    description: "Filter by role",
  })
  @ApiQuery({
    name: "status",
    enum: MemberStatus,
    required: false,
    description: "Filter by status",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Members retrieved successfully",
    type: [OrganizationMemberResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getMembers(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Query() filters: MemberFilterDto,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationMemberResponseDto[]> {
    return this.organizationService.getMembers(
      organizationId,
      currentUserId,
      filters,
    );
  }

  @Get(":id/members/:memberId")
  @ApiOperation({ summary: "Get member by ID" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "Member ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Member retrieved successfully",
    type: OrganizationMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Member not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getMemberById(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationMemberResponseDto> {
    // Можно добавить метод в сервис для получения конкретного участника
    const members = await this.organizationService.getMembers(
      organizationId,
      currentUserId,
    );
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      // В реальности лучше сделать отдельный метод в сервисе
      throw new Error("Member not found");
    }
    return member;
  }

  @Put(":id/members/:memberId")
  @ApiOperation({ summary: "Update organization member" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "Member ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Member updated successfully",
    type: OrganizationMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Member not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  async updateMember(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body() updateMemberDto: UpdateOrganizationMemberDto,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationMemberResponseDto> {
    return this.organizationService.updateMember(
      organizationId,
      memberId,
      updateMemberDto,
      currentUserId,
    );
  }

  @Delete(":id/members/:memberId")
  @ApiOperation({ summary: "Remove member from organization" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "Member ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Member removed successfully",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Member not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Cannot remove owner",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<void> {
    await this.organizationService.removeMember(
      organizationId,
      memberId,
      currentUserId,
    );
  }

  // ==================== HOLIDAY ENDPOINTS ====================

  @Post(":id/holidays")
  @ApiOperation({ summary: "Add holiday to organization" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Holiday added successfully",
    type: HolidayResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Holiday already exists",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  @HttpCode(HttpStatus.CREATED)
  async addHoliday(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Body() createHolidayDto: CreateHolidayDto,
    @GetUser("id") currentUserId: string,
  ): Promise<HolidayResponseDto> {
    return this.organizationService.addHoliday(
      organizationId,
      createHolidayDto,
      currentUserId,
    );
  }

  @Get(":id/holidays")
  @ApiOperation({ summary: "Get all organization holidays" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiQuery({
    name: "year",
    required: false,
    description: "Filter by year",
    type: "number",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Holidays retrieved successfully",
    type: [HolidayResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getHolidays(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Query() filters: HolidayFilterDto,
    @GetUser("id") currentUserId: string,
  ): Promise<HolidayResponseDto[]> {
    return this.organizationService.getHolidays(
      organizationId,
      currentUserId,
      filters.year,
    );
  }

  @Put(":id/holidays/:holidayId")
  @ApiOperation({ summary: "Update holiday" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "holidayId",
    description: "Holiday ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Holiday updated successfully",
    type: HolidayResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Holiday not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  async updateHoliday(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("holidayId", ParseUUIDPipe) holidayId: string,
    @Body() updateHolidayDto: UpdateHolidayDto,
    @GetUser("id") currentUserId: string,
  ): Promise<HolidayResponseDto> {
    return this.organizationService.updateHoliday(
      organizationId,
      holidayId,
      updateHolidayDto,
      currentUserId,
    );
  }

  @Delete(":id/holidays/:holidayId")
  @ApiOperation({ summary: "Delete holiday" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "holidayId",
    description: "Holiday ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Holiday deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Holiday not found",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Permission denied",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHoliday(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("holidayId", ParseUUIDPipe) holidayId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<void> {
    await this.organizationService.deleteHoliday(
      organizationId,
      holidayId,
      currentUserId,
    );
  }

  // ==================== UTILITY ENDPOINTS ====================

  @Get(":id/stats")
  @ApiOperation({ summary: "Get organization statistics" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Statistics retrieved successfully",
    type: OrganizationStatsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Organization not found",
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Access denied" })
  async getOrganizationStats(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @GetUser("id") currentUserId: string,
  ): Promise<OrganizationStatsResponseDto> {
    return this.organizationService.getOrganizationStats(
      organizationId,
      currentUserId,
    );
  }

  @Get(":id/has-role/:role")
  @ApiOperation({ summary: "Check if current user has specific role" })
  @ApiParam({
    name: "id",
    description: "Organization ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({ name: "role", enum: MemberRole, description: "Role to check" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Role check result",
    schema: { type: "boolean", example: true },
  })
  async hasRole(
    @Param("id", ParseUUIDPipe) organizationId: string,
    @Param("role") role: MemberRole,
    @GetUser("id") currentUserId: string,
  ): Promise<{ hasRole: boolean }> {
    const result = await this.organizationService.hasRole(
      organizationId,
      currentUserId,
      role,
    );
    return { hasRole: result };
  }
}
