import { IOrganizationRepository } from "@/organizations/domain/repositories/organization.repository.interface";
import { Injectable, Inject, ForbiddenException } from "@nestjs/common";

@Injectable()
export class GetOrganizationMembersUseCase {
  constructor(
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(organizationId: string, userId: string) {
    // Проверяем, состоит ли запрашивающий в этой организации
    const member = await this.orgRepo.findMember(userId, organizationId);
    if (!member) throw new ForbiddenException("Access denied");

    return await this.orgRepo.findAllMembers(organizationId);
  }
}
