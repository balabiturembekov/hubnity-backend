import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller";
import { CompanySettingsController } from "./company-settings.controller";
import { CompaniesService } from "./companies.service";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsModule } from "../events/events.module";
import { ProjectsModule } from "../projects/projects.module";
import { UsersModule } from "../users/users.module";
import { TimeEntriesModule } from "../time-entries/time-entries.module";
import { TeamActivityModule } from "../team-activity/team-activity.module";

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    ProjectsModule,
    UsersModule,
    TimeEntriesModule,
    TeamActivityModule,
  ],
  controllers: [CompaniesController, CompanySettingsController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
