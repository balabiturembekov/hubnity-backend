import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { IOrganizationRepository } from "../../domain/repositories/organization.repository.interface";

@Injectable()
export class UpdateOrganizationUseCase {
  constructor(
    @Inject("IOrganizationRepository")
    private readonly orgRepo: IOrganizationRepository,
  ) {}

  async execute(
    id: string,
    userId: string,
    data: {
      name?: string;
      interval?: number;
      blur?: boolean;
      idleTimeout?: number;
    },
  ) {
    const organization = await this.orgRepo.findById(id);

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    if (organization.ownerId !== userId) {
      throw new ForbiddenException(
        "Only the owner can modify the organization",
      );
    }

    if (data.name) {
      organization.rename(data.name);
    }

    if (
      data.interval !== undefined ||
      data.blur !== undefined ||
      data.idleTimeout !== undefined
    ) {
      organization.updateTrackingSettings(
        data.interval ?? organization.screenshotInterval,
        data.blur ?? organization.allowBlur,
        data.idleTimeout ?? organization.idleTimeout,
      );
    }

    return await this.orgRepo.save(organization);
  }
}
