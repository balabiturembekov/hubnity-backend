import { Module } from "@nestjs/common";
import { ScreenshotsController } from "./screenshots.controller";
import { ScreenshotsService } from "./screenshots.service";
import { PrismaModule } from "../prisma/prisma.module";
import { S3Module } from "../s3/s3.module";

@Module({
  imports: [PrismaModule, S3Module],
  controllers: [ScreenshotsController],
  providers: [ScreenshotsService],
  exports: [ScreenshotsService],
})
export class ScreenshotsModule {}
