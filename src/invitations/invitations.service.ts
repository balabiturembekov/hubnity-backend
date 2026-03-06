import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { SendInvitationDto } from "@/invitations/dto/send-invitation.dto";
import { MemberRole, MemberStatus } from "@prisma/client";
import { randomBytes } from "crypto";

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private assertRoleAllowedToInvite(inviteRole: MemberRole) {
    if (inviteRole !== MemberRole.MANAGER && inviteRole !== MemberRole.USER) {
      throw new ConflictException(
        "Only MANAGER or USER invitations are supported",
      );
    }
  }

  private async assertCanManageInvitations(
    organizationId: string,
    currentUserId: string,
  ) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: currentUserId,
        },
      },
      select: { role: true, status: true },
    });

    if (!member || member.status !== MemberStatus.ACTIVE) {
      throw new ForbiddenException("You have no access to this organization");
    }

    const allowed: MemberRole[] = [
      MemberRole.OWNER,
      MemberRole.ADMIN,
      MemberRole.MANAGER,
    ];

    if (!allowed.includes(member.role)) {
      throw new ForbiddenException("You are not allowed to manage invitations");
    }

    return member;
  }

  async sendOneInvitation(
    sendInvitationDto: SendInvitationDto,
    currentUserId: string,
  ) {
    const { organizationId, role } = sendInvitationDto;
    const email = this.normalizeEmail(sendInvitationDto.email);

    this.assertRoleAllowedToInvite(role);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    await this.assertCanManageInvitations(organizationId, currentUserId);

    const existing = await this.prisma.invitation.findFirst({
      where: {
        email,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      throw new ConflictException(
        "A pending invitation already exists for this email",
      );
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (existingUser) {
      const isMember = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      });

      if (isMember) {
        throw new ConflictException("User is already a member");
      }
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    return await this.prisma.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
        organizationId,
        invitedById: currentUserId,
        userId: existingUser?.id ?? null,
      },
      include: {
        organization: { select: { id: true, name: true } },
        invitedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async acceptInvitation(
    token: string,
    currentUserId: string,
    currentUserEmail: string,
  ) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.acceptedAt)
      throw new ConflictException("Invitation already accepted");
    if (invitation.expiresAt < new Date())
      throw new ConflictException("Invitation has expired");

    const normalizedEmail = this.normalizeEmail(currentUserEmail);
    if (this.normalizeEmail(invitation.email) !== normalizedEmail) {
      throw new ForbiddenException("This invitation is not for your email");
    }

    if (invitation.userId && invitation.userId !== currentUserId) {
      throw new ForbiddenException(
        "This invitation is assigned to another user",
      );
    }

    this.assertRoleAllowedToInvite(invitation.role);

    const alreadyMember = await this.prisma.organizationMember.findFirst({
      where: {
        userId: currentUserId,
        organizationId: invitation.organizationId,
      },
    });
    if (alreadyMember) {
      throw new ConflictException(
        "User is already a member of this organization",
      );
    }

    const [updatedInvitation] = await this.prisma.$transaction([
      this.prisma.invitation.update({
        where: { token },
        data: { acceptedAt: new Date(), userId: currentUserId },
      }),
      this.prisma.organizationMember.create({
        data: {
          role: invitation.role,
          status: MemberStatus.ACTIVE,
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
          organization: { connect: { id: invitation.organizationId } },
          user: { connect: { id: currentUserId } },
          invitedBy: { connect: { id: invitation.invitedById } },
          settings: {},
        },
      }),
    ]);

    return updatedInvitation;
  }

  async revokeInvitation(invitationId: string, currentUserId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        id: true,
        organizationId: true,
        acceptedAt: true,
      },
    });

    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.acceptedAt)
      throw new ConflictException("Cannot revoke an accepted invitation");

    await this.assertCanManageInvitations(
      invitation.organizationId,
      currentUserId,
    );

    return this.prisma.invitation.delete({ where: { id: invitationId } });
  }

  async getOrganizationInvitations(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.assertCanManageInvitations(organizationId, currentUserId);

    return this.prisma.invitation.findMany({
      where: { organizationId },
      include: {
        invitedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        invitedUser: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
