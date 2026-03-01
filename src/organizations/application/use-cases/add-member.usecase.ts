import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { IOrganizationRepository } from "@/organizations/domain/repositories/organization.repository.interface";
import { OrganizationRole } from "@prisma/client";

@Injectable()
export class AddMemberUseCase {
  constructor(
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(
    organizationId: string,
    adminId: string,
    targetUserId: string,
    role: OrganizationRole,
  ) {
    // 1. Находим организацию
    const organization = await this.orgRepo.findById(organizationId);
    if (!organization) throw new NotFoundException("Organization not found");

    // 2. Проверка прав (только OWNER или MANAGER)
    const requester = await this.orgRepo.findMember(adminId, organizationId);
    if (!requester || !["OWNER", "MANAGER"].includes(requester.role)) {
      throw new ForbiddenException("No permission to add members");
    }

    // 3. Проверяем, не состоит ли уже юзер в этой орг
    const existing = await this.orgRepo.findMember(
      targetUserId,
      organizationId,
    );
    if (existing) throw new ConflictException("User is already a member");

    // 4. Сохраняем нового участника через репозиторий
    return await this.orgRepo.addMember({
      organizationId,
      userId: targetUserId,
      role,
      status: "ACTIVE",
    });
  }
}
