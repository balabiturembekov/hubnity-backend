import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
