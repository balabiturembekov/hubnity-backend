import { Module } from "@nestjs/common";
import { UrlActivityController } from "./url-activity.controller";
import { UrlActivityService } from "./url-activity.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [UrlActivityController],
  providers: [UrlActivityService],
  exports: [UrlActivityService],
})
export class UrlActivityModule {}
