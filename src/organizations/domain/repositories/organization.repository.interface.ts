import { Organization } from "../entities/organization.entity";
import { OrganizationMember, OrganizationRole } from "@prisma/client";

export interface IOrganizationRepository {
  save(organization: Organization): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  createWithMember(organization: Organization): Promise<Organization>;
  findMember(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMember | null>;
  addMember(data: any): Promise<OrganizationMember>;
  removeMember(userId: string, organizationId: string);
  findAllMembers(organizationId: string): Promise<OrganizationMember[]>;
  updateMemberRole(
    userId: string,
    organizationId: string,
    newRole: OrganizationRole,
  ): Promise<OrganizationMember>;
}
