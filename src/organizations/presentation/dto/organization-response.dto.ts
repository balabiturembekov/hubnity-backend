import { Organization } from "@/organizations/domain/entities/organization.entity";

export class OrganizationResponseDto {
  id: string;
  name: string;
  ownerId: string;
  plan: string;
  settings: {
    screenshotInterval: number;
    allowBlur: boolean;
  };
  createdAt: string;

  static fromDomain(org: Organization): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name, // Используем геттер, скрываем Value Object
      ownerId: org.ownerId,
      plan: org.plan,
      settings: {
        screenshotInterval: org.screenshotInterval,
        allowBlur: org.allowBlur,
      },
      createdAt: org.createdAt.toISOString(),
    };
  }
}
