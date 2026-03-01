import { Injectable } from "@nestjs/common";

@Injectable()
export class OrganizationAccessService {
  canManageMembers(adminRole: string): boolean {
    return ["OWNER", "MANAGER"].includes(adminRole);
  }

  canDeleteOrganization(adminRole: string): boolean {
    return adminRole === "OWNER";
  }
}
