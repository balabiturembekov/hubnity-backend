import { Injectable, Logger } from "@nestjs/common";
import { CreateOrganizationGoalDto } from "./dto/create-organization-goal.dto";
import { UpdateOrganizationGoalDto } from "./dto/update-organization-goal.dto";
import { PrismaService } from "@/prisma/prisma.service";
import { EntityNotFoundException } from "@/exceptions/business.exception";

@Injectable()
export class OrganizationGoalsService {
  private readonly logger = new Logger(OrganizationGoalsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationGoalDto) {
    return this.prisma.organizationGoal.create({
      data: {
        title: dto.title,
        subTitle: dto.subTitle,
        isPopular: dto.isPopular ?? false,
      },
    });
  }

  async findAll() {
    return this.prisma.organizationGoal.findMany();
  }

  async findOne(id: string) {
    return this.prisma.organizationGoal.findFirst({
      where: { id },
    });
  }

  async update(id: string, dto: UpdateOrganizationGoalDto) {
    const foundGoal = await this.prisma.organizationGoal.findFirst({
      where: { id },
    });

    if (!foundGoal) throw new EntityNotFoundException("Organization goal", id);

    return await this.prisma.organizationGoal.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.subTitle !== undefined && { subTitle: dto.subTitle }),
        ...(dto.isPopular !== undefined && { isPopular: dto.isPopular }),
      },
    });
  }

  async remove(id: string) {
    const found = await this.prisma.organizationGoal.findFirst({
      where: { id },
    });

    if (!found) throw new EntityNotFoundException("Organization goal", id);

    try {
      await this.prisma.organizationGoal.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Failed to delete organization goal: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
