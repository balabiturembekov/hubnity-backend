import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventsGateway } from "./events.gateway";
import { StatsProcessor } from "./processors/stats.processor";
import { PrismaModule } from "../prisma/prisma.module";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [
    PrismaModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get("REDIS_HOST") || "localhost",
          port: parseInt(configService.get("REDIS_PORT") || "6379", 10),
          password: configService.get("REDIS_PASSWORD") || undefined,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: "stats",
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET") || "secret",
        signOptions: {
          expiresIn: configService.get("JWT_EXPIRES_IN") || "7d",
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EventsGateway, StatsProcessor],
  exports: [EventsGateway],
})
export class EventsModule {}
