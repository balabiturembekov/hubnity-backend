import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { InvitationsService } from "./invitations.service";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth("JWT-auth")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Send invitation",
    description:
      "Create and send an invitation to join the company. Only OWNER and ADMIN can invite.",
  })
  @ApiBody({ type: CreateInvitationDto })
  @ApiResponse({
    status: 201,
    description: "Invitation created and sent",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        email: { type: "string", example: "user@example.com" },
        role: { type: "string", enum: ["EMPLOYEE", "MANAGER", "ADMIN"] },
        expiresAt: { type: "string", format: "date-time" },
        inviteLink: { type: "string", example: "http://localhost:3002/register?token=..." },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Forbidden - not owner/admin" })
  @ApiResponse({ status: 409, description: "User already exists or invitation already sent" })
  async create(
    @Body() dto: CreateInvitationDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.invitationsService.create(
      dto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get(":token")
  @ApiOperation({
    summary: "Validate invitation token",
    description:
      "Public endpoint. Returns invitation details if the token is valid and not expired.",
  })
  @ApiParam({ name: "token", description: "Invitation token from the invite link" })
  @ApiResponse({
    status: 200,
    description: "Invitation is valid",
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean", example: true },
        email: { type: "string", example: "user@example.com" },
        role: { type: "string", enum: ["EMPLOYEE", "MANAGER", "ADMIN"] },
        companyId: { type: "string", example: "uuid" },
        companyName: { type: "string", example: "Acme Inc" },
        expiresAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Token invalid or expired" })
  @ApiResponse({ status: 404, description: "Invitation not found" })
  async validate(@Param("token") token: string) {
    if (!token || token.trim().length === 0) {
      throw new BadRequestException("Token is required");
    }
    try {
      return await this.invitationsService.validateToken(token);
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof BadRequestException) {
        throw e;
      }
      throw e;
    }
  }
}
