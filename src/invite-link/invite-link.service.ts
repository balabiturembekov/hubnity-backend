import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateInviteLinkDto } from "./dto/create-invite-link.dto";
import { PrismaService } from "@/prisma/prisma.service";
import { randomBytes } from "crypto";
import { MemberRole, MemberStatus } from "@prisma/client";

@Injectable()
export class InviteLinkService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRoleAllowedToInvite(inviteRole: MemberRole) {
    if (inviteRole !== MemberRole.MANAGER && inviteRole !== MemberRole.USER) {
      throw new ConflictException(
        "Only MANAGER or USER roles are allowed for invite links",
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
      throw new ForbiddenException(
        "You are not allowed to manage invite links",
      );
    }

    return member;
  }

  async createInviteLink(dto: CreateInviteLinkDto, currentUserId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    await this.assertCanManageInvitations(dto.organizationId, currentUserId);
    this.assertRoleAllowedToInvite(dto.role ?? MemberRole.USER);

    const token = randomBytes(32).toString("hex");
    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.inviteLink.create({
      data: {
        token,
        role: dto.role ?? MemberRole.USER,
        organizationId: dto.organizationId,
        createdById: currentUserId,
        expiresAt,
        maxUses: dto.maxUses ?? null,
      },
    });
  }

  async getOrganizationInviteLinks(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.assertCanManageInvitations(organizationId, currentUserId);

    return this.prisma.inviteLink.findMany({
      where: { organizationId },
      select: {
        id: true,
        token: true,
        role: true,
        organizationId: true,
        expiresAt: true,
        maxUses: true,
        useCount: true,
        isActive: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async joinViaInviteLink(token: string, currentUserId: string) {
    const link = await this.prisma.inviteLink.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true } } },
    });

    if (!link) throw new NotFoundException("Invite link not found");
    if (!link.isActive) throw new ConflictException("Invite link is disabled");
    if (link.expiresAt && link.expiresAt < new Date())
      throw new ConflictException("Invite link has expired");
    if (link.maxUses !== null && link.useCount >= link.maxUses)
      throw new ConflictException("Invite link has reached its usage limit");

    const alreadyMember = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: link.organizationId,
          userId: currentUserId,
        },
      },
    });
    if (alreadyMember) throw new ConflictException("Already a member");

    await this.prisma.$transaction([
      this.prisma.organizationMember.create({
        data: {
          role: link.role,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
          invitedAt: new Date(),
          organization: { connect: { id: link.organizationId } },
          user: { connect: { id: currentUserId } },
          invitedBy: { connect: { id: link.createdById } },
          settings: {},
        },
      }),
      this.prisma.inviteLink.update({
        where: { token },
        data: { useCount: { increment: 1 } },
      }),
    ]);

    return link.organization;
  }

  async revokeInviteLink(linkId: string, currentUserId: string) {
    const link = await this.prisma.inviteLink.findUnique({
      where: { id: linkId },
      select: { id: true, organizationId: true },
    });

    if (!link) throw new NotFoundException("Invite link not found");
    await this.assertCanManageInvitations(link.organizationId, currentUserId);

    return this.prisma.inviteLink.update({
      where: { id: linkId },
      data: { isActive: false },
    });
  }
}
