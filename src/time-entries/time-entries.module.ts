import { Module } from "@nestjs/common";
import { TimeEntriesService } from "./time-entries.service";
import { TimeEntriesController } from "./time-entries.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [PrismaModule, EventsModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
