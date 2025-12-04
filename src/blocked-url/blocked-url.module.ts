import { Module } from "@nestjs/common";
import { BlockedUrlController } from "./blocked-url.controller";
import { BlockedUrlService } from "./blocked-url.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [BlockedUrlController],
  providers: [BlockedUrlService],
  exports: [BlockedUrlService],
})
export class BlockedUrlModule {}
