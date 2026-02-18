import { Module } from "@nestjs/common";
import { TimeEntriesService } from "./time-entries.service";
import { TimeEntriesController } from "./time-entries.controller";
import { TimeEntriesActionService } from "./time-entries-action.service";
import { TimeEntriesApprovalService } from "./time-entries-approval.service";
import { TimeEntriesInternalService } from "./time-entries-internal.service";
import { PrismaModule } from "../prisma/prisma.module";
import { CacheModule } from "../cache/cache.module";
import { EventsModule } from "../events/events.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ScreenshotsModule } from "../screenshots/screenshots.module";

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    EventsModule,
    NotificationsModule,
    ScreenshotsModule,
  ],
  controllers: [TimeEntriesController],
  providers: [
    TimeEntriesInternalService,
    TimeEntriesActionService,
    TimeEntriesApprovalService,
    TimeEntriesService,
  ],
  exports: [TimeEntriesService],
})
export class TimeEntriesModule {}
