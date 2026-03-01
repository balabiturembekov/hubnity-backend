import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { IOrganizationRepository } from "../../domain/repositories/organization.repository.interface";

@Injectable()
export class UpdateMemberRoleUseCase {
  constructor(
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(
    organizationId: string,
    adminId: string,
    targetUserId: string,
    newRole: OrganizationRole,
  ) {
    // 1. Проверка прав: только OWNER может менять роли (или MANAGER может менять роли ниже себя)
    const requester = await this.orgRepo.findMember(adminId, organizationId);
    if (!requester || requester.role !== "OWNER") {
      throw new ForbiddenException("Only organization owner can change roles");
    }

    // 2. Находим целевого участника
    const targetMember = await this.orgRepo.findMember(
      targetUserId,
      organizationId,
    );
    if (!targetMember) throw new NotFoundException("Member not found");

    // 3. Обновляем через репозиторий
    return await this.orgRepo.updateMemberRole(
      targetUserId,
      organizationId,
      newRole,
    );
  }
}
