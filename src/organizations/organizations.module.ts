import { Module } from "@nestjs/common";
import { OrganizationsController } from "@/organizations/presentation/organizations.controller";
import { PrismaModule } from "@/prisma/prisma.module";
import { PrismaOrganizationRepository } from "./infrastructure/prisma/organization.repository";
import { CreateOrganizationUseCase } from "./application/use-cases/create-organization.usecase";
import { UpdateOrganizationUseCase } from "./application/use-cases/update-orgaanization.usecase";
import { AddMemberUseCase } from "./application/use-cases/add-member.usecase";
import { GetOrganizationMembersUseCase } from "./application/use-cases/get-organization-members.usecase";
import { UpdateMemberRoleUseCase } from "./application/use-cases/update-member-role.usecase";

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [
    CreateOrganizationUseCase,
    UpdateOrganizationUseCase,
    UpdateMemberRoleUseCase,
    GetOrganizationMembersUseCase,
    AddMemberUseCase,
    {
      provide: "IOrganizationRepository",
      useClass: PrismaOrganizationRepository,
    },
  ],
})
export class OrganizationsModule {}
