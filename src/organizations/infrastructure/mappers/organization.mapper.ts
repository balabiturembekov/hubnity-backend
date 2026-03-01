import { Organization as PrismaOrg } from "@prisma/client";
import { Organization } from "../../domain/entities/organization.entity";
import { OrganizationName } from "../../domain/value-objects/organization-name.vo";

export class OrganizationMapper {
  static toPersistence(domain: Organization) {
    return {
      id: domain.id,
      name: domain.name,
      ownerID: domain.ownerId, // Prisma: ownerID
      plan: domain.plan,
      currency: domain.currency,
      weekStart: domain.weekStart,
      settings: domain.settings,
      createdAt: domain.createdAt,
      updatedAt: domain.updatedAt,
      screenshotInterval: domain.screenshotInterval,
      allowBlur: domain.allowBlur,
      trackApps: domain.trackApps,
      trackUrls: domain.trackUrls,
      idleTimeout: domain.idleTimeout,
      idleAction: domain.idleAction,
    };
  }

  static toDomain(raw: PrismaOrg): Organization {
    return new Organization(
      raw.id,
      new OrganizationName(raw.name),
      raw.ownerID,
      raw.screenshotInterval,
      raw.allowBlur,
      raw.trackApps,
      raw.trackUrls,
      raw.idleTimeout,
      raw.idleAction,
      raw.plan,
      raw.currency,
      raw.weekStart,
      raw.settings,
      raw.createdAt,
      raw.updatedAt,
    );
  }
}
