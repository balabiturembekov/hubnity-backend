import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { CompaniesModule } from "../companies/companies.module";

@Module({
  imports: [CompaniesModule],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
