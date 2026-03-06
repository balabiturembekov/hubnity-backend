import { Module } from "@nestjs/common";
import { OrganizationService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";

@Module({
  providers: [OrganizationService],
  controllers: [OrganizationsController],
  exports: [OrganizationService],
})
export class OrganizationsModule {}
