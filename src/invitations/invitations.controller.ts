import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { InvitationsService } from "./invitations.service";
import { SendInvitationDto } from "@/invitations/dto/send-invitation.dto";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { GetUser } from "@/auth/decorators/get-user.decorator";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

@Controller("invitations")
@ApiTags("invitations")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @ApiOperation({ summary: "Send one invitation to organization" })
  @ApiResponse({ status: 201, description: "Invitation created" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Organization not found" })
  @ApiResponse({
    status: 409,
    description: "Conflict (already invited/member)",
  })
  async sendInvitation(
    @GetUser("id") currentUserId: string,
    @Body() dto: SendInvitationDto,
  ) {
    return this.invitationsService.sendOneInvitation(dto, currentUserId);
  }

  @Patch(":token/accept")
  @ApiOperation({ summary: "Accept invitation by token (current user)" })
  @ApiParam({ name: "token", type: String, description: "Invitation token" })
  @ApiResponse({ status: 200, description: "Invitation accepted" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden (not your invite)" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  @ApiResponse({
    status: 409,
    description: "Conflict (expired/accepted/member)",
  })
  async acceptInvitation(
    @Param("token") token: string,
    @GetUser("id") currentUserId: string,
    @GetUser("email") currentUserEmail: string,
  ) {
    return await this.invitationsService.acceptInvitation(
      token,
      currentUserId,
      currentUserEmail,
    );
  }

  @Delete(":id")
  @ApiOperation({ summary: "Revoke invitation (organization managers/admins)" })
  @ApiParam({ name: "id", type: String, format: "uuid" })
  @ApiResponse({ status: 200, description: "Invitation revoked" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  @ApiResponse({ status: 409, description: "Conflict (already accepted)" })
  async revokeInvitation(
    @Param("id", ParseUUIDPipe) id: string,
    @GetUser("id") currentUserId: string,
  ) {
    return await this.invitationsService.revokeInvitation(id, currentUserId);
  }

  @Get("organization/:organizationId")
  @ApiOperation({ summary: "List organization invitations" })
  @ApiParam({
    name: "organizationId",
    type: String,
    format: "uuid",
    description: "Organization ID",
  })
  @ApiResponse({ status: 200, description: "Invitations list" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getOrganizationInvitations(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @GetUser("id") currentUserId: string,
  ) {
    return await this.invitationsService.getOrganizationInvitations(
      organizationId,
      currentUserId,
    );
  }
}
