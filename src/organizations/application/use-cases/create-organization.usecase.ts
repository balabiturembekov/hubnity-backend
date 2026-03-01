import { Injectable, Inject } from "@nestjs/common";
import { IOrganizationRepository } from "../../domain/repositories/organization.repository.interface";
import { Organization } from "../../domain/entities/organization.entity";
import { v4 as uuid } from "uuid";
import { IdleAction, OrganizationPlan } from "@prisma/client";
import { OrganizationName } from "@/organizations/domain/value-objects/organization-name.vo";

@Injectable()
export class CreateOrganizationUseCase {
  constructor(
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(name: string, userId: string) {
    const organizationId = uuid();

    const organization = new Organization(
      organizationId,
      new OrganizationName(name),
      userId,
      600,
      false,
      true,
      true,
      300,
      IdleAction.ASK_USER,
      OrganizationPlan.FREE,
      "USD",
      1,
      null,
      new Date(),
      new Date(),
    );

    return await this.orgRepo.createWithMember(organization);
  }
}
