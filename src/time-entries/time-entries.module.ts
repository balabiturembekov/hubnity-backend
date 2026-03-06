import { Module } from "@nestjs/common";
import { TimeEntriesController } from "./time-entries.controller";
import { ScreenshotsController } from "./screenshots.controller";
import { TimeEntriesService } from "./time-entries.service";
import { PrismaModule } from "../prisma/prisma.module";
import { MulterModule } from "@nestjs/platform-express";
import { ApprovalService } from "./approval.service";
import { ApprovalController } from "./approval.controller";

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: "./uploads",
    }),
  ],
  controllers: [
    TimeEntriesController,
    ScreenshotsController,
    ApprovalController,
  ],
  providers: [TimeEntriesService, ApprovalService],
  exports: [TimeEntriesService, ApprovalService],
})
export class TimeEntriesModule {}
