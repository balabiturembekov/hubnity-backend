import { Module } from "@nestjs/common";
import { IdleDetectionService } from "./idle-detection.service";
import { IdleDetectionController } from "./idle-detection.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EventsModule } from "../events/events.module";
import { TimeEntriesModule } from "../time-entries/time-entries.module";
// ScheduleModule уже импортирован глобально в AuthModule, не нужно дублировать

@Module({
  imports: [
    PrismaModule,
    EventsModule,
    TimeEntriesModule,
    // ScheduleModule.forRoot() уже импортирован в AuthModule, не дублируем
  ],
  controllers: [IdleDetectionController],
  providers: [IdleDetectionService],
  exports: [IdleDetectionService],
})
export class IdleDetectionModule {}
