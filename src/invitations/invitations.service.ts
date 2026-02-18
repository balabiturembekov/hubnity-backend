import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { MailerService } from "../mailer/mailer.service";
import { ConfigService } from "@nestjs/config";
import { CreateInvitationDto } from "./dto/create-invitation.dto";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";

const INVITATION_EXPIRES_IN_DAYS = 7;
const TOKEN_LENGTH = 32;

@Injectable()
export class InvitationsService {
  constructor(
    private prisma: PrismaService,
    private mailer: MailerService,
    private config: ConfigService,
  ) {}

  /**
   * Create an invitation. Only OWNER/ADMIN can invite.
   */
  async create(
    dto: CreateInvitationDto,
    companyId: string,
    inviterId: string,
    inviterRole: UserRole,
  ) {
    if (
      inviterRole !== UserRole.OWNER &&
      inviterRole !== UserRole.ADMIN &&
      inviterRole !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        "Only owners and admins can send invitations",
      );
    }

    // Cannot invite as OWNER (only one owner per company)
    const role = dto.role ?? UserRole.EMPLOYEE;
    if (role === UserRole.OWNER || role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        "Cannot invite users with OWNER or SUPER_ADMIN role",
      );
    }

    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if user already exists in this company
    const existingUser = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, companyId },
    });
    if (existingUser) {
      throw new ConflictException(
        "A user with this email already exists in your company",
      );
    }

    // Check for pending invitation
    const existingInvitation = await this.prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        companyId,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvitation) {
      throw new ConflictException(
        "An invitation has already been sent to this email",
      );
    }

    const token = randomBytes(TOKEN_LENGTH).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRES_IN_DAYS);

    const invitation = await this.prisma.invitation.create({
      data: {
        email: normalizedEmail,
        token,
        companyId,
        role,
        expiresAt,
        inviterId,
      },
      include: {
        company: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } },
      },
    });

    const frontendUrl =
      this.config.get("FRONTEND_URL") || "http://localhost:3002";
    const inviteLink = `${frontendUrl}/register?token=${token}`;

    await this.mailer.sendInvitation({
      to: normalizedEmail,
      inviterName: invitation.inviter?.name ?? "A team member",
      companyName: invitation.company.name,
      inviteLink,
      expiresAt,
    });

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      inviteLink, // Return for dev/testing; frontend can use token from URL
    };
  }

  /**
   * Validate invitation token. Public endpoint.
   */
  async validateToken(token: string) {
    if (!token || token.trim().length === 0) {
      throw new BadRequestException("Token is required");
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { token: token.trim() },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException("Invitation not found");
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException("Invitation has expired");
    }

    return {
      valid: true,
      email: invitation.email,
      role: invitation.role,
      companyId: invitation.companyId,
      companyName: invitation.company.name,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Consume invitation (mark as used by deleting). Called from AuthService.register.
   */
  async consumeByToken(token: string): Promise<{
    email: string;
    companyId: string;
    role: UserRole;
  } | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: token.trim() },
    });

    if (!invitation || invitation.expiresAt < new Date()) {
      return null;
    }

    await this.prisma.invitation.delete({
      where: { id: invitation.id },
    });

    return {
      email: invitation.email,
      companyId: invitation.companyId,
      role: invitation.role,
    };
  }
}
