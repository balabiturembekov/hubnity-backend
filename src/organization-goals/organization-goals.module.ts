import { Module } from "@nestjs/common";
import { OrganizationGoalsService } from "./organization-goals.service";
import { OrganizationGoalsController } from "./organization-goals.controller";

@Module({
  controllers: [OrganizationGoalsController],
  providers: [OrganizationGoalsService],
  exports: [OrganizationGoalsService],
})
export class OrganizationGoalsModule {}
