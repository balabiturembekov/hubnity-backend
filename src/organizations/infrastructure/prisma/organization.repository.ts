import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { IOrganizationRepository } from "../../domain/repositories/organization.repository.interface";
import { Organization } from "../../domain/entities/organization.entity";
import { OrganizationMapper } from "../mappers/organization.mapper";
import {
  OrganizationRole,
  MemberStatus,
  OrganizationMember,
} from "@prisma/client";

@Injectable()
export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // В PrismaOrganizationRepository
  async createWithMember(org: Organization): Promise<Organization> {
    await this.prisma.$transaction(async (tx) => {
      // Используем маппер для соблюдения схемы Prisma
      await tx.organization.create({
        data: OrganizationMapper.toPersistence(org),
      });

      await tx.organizationMember.create({
        data: {
          userId: org.ownerId,
          organizationId: org.id,
          role: "OWNER",
          status: "ACTIVE",
        },
      });
    });
    return org;
  }

  async findById(id: string): Promise<Organization | null> {
    const raw = await this.prisma.organization.findUnique({ where: { id } });
    return raw ? OrganizationMapper.toDomain(raw) : null;
  }

  async save(org: Organization): Promise<Organization> {
    await this.prisma.organization.update({
      where: { id: org.id },
      data: OrganizationMapper.toPersistence(org),
    });
    return org;
  }

  async findMember(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMember | null> {
    return await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  async addMember(data: any): Promise<OrganizationMember> {
    return await this.prisma.organizationMember.create({
      data,
    });
  }

  async removeMember(userId: string, organizationId: string) {
    return await this.prisma.organizationMember.delete({
      where: { userId_organizationId: { userId, organizationId } },
    });
  }

  async updateMemberRole(
    userId: string,
    organizationId: string,
    role: OrganizationRole,
  ) {
    return await this.prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role },
    });
  }

  async findAllMembers(organizationId: string) {
    return await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true, avatar: true } } },
    });
  }
}
