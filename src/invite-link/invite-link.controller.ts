import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { InviteLinkService } from "./invite-link.service";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto";
import { GetUser } from "@/auth/decorators/get-user.decorator";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { InviteLinkEntity } from "./entities/invite-link.entity";

@ApiTags("invite-link")
@Controller("invite-link")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class InviteLinkController {
  constructor(private readonly inviteLinkService: InviteLinkService) {}

  @Post("links")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create invite link",
    description:
      "Create a new invite link for an organization. Only OWNER, ADMIN, or MANAGER can create. Role must be MANAGER or USER.",
  })
  @ApiBody({ type: CreateInviteLinkDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Invite link created",
    type: InviteLinkEntity,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid input" })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Not allowed to manage invite links",
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Only MANAGER or USER roles allowed",
  })
  createInviteLink(
    @GetUser("id") userId: string,
    @Body() dto: CreateInviteLinkDto,
  ) {
    return this.inviteLinkService.createInviteLink(dto, userId);
  }

  @Post("links/:token/join")
  @ApiOperation({
    summary: "Join organization via invite link",
    description:
      "Use an invite link token to join the organization as the current user.",
  })
  @ApiParam({ name: "token", description: "Invite link token" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Joined organization successfully",
    schema: {
      type: "object",
      properties: { id: { type: "string" }, name: { type: "string" } },
    },
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Invite link not found",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Link disabled, expired, limit reached, or already a member",
  })
  joinViaInviteLink(
    @Param("token") token: string,
    @GetUser("id") userId: string,
  ) {
    return this.inviteLinkService.joinViaInviteLink(token, userId);
  }

  @Patch("links/:id/revoke")
  @ApiOperation({
    summary: "Revoke invite link",
    description:
      "Deactivate an invite link. Only users who can manage invite links can revoke.",
  })
  @ApiParam({ name: "id", description: "Invite link UUID" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Invite link revoked",
    type: InviteLinkEntity,
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Forbidden" })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Invite link not found",
  })
  revokeInviteLink(
    @Param("id", ParseUUIDPipe) id: string,
    @GetUser("id") userId: string,
  ) {
    return this.inviteLinkService.revokeInviteLink(id, userId);
  }

  @Get("links/organization/:organizationId")
  @ApiOperation({
    summary: "List organization invite links",
    description:
      "Get all invite links for an organization. Only OWNER, ADMIN, or MANAGER.",
  })
  @ApiParam({
    name: "organizationId",
    description: "Organization UUID",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of invite links",
    type: [InviteLinkEntity],
  })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: "Unauthorized" })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: "Forbidden" })
  getInviteLinks(
    @Param("organizationId", ParseUUIDPipe) orgId: string,
    @GetUser("id") userId: string,
  ) {
    return this.inviteLinkService.getOrganizationInviteLinks(orgId, userId);
  }
}
