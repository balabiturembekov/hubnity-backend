import { Module } from "@nestjs/common";
import { AppActivityController } from "./app-activity.controller";
import { AppActivityService } from "./app-activity.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AppActivityController],
  providers: [AppActivityService],
  exports: [AppActivityService],
})
export class AppActivityModule {}
