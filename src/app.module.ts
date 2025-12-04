import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProjectsModule } from "./projects/projects.module";
import { TimeEntriesModule } from "./time-entries/time-entries.module";
import { EventsModule } from "./events/events.module";
import { ScreenshotsModule } from "./screenshots/screenshots.module";
import { TeamActivityModule } from "./team-activity/team-activity.module";
import { CompaniesModule } from "./companies/companies.module";
import { CacheModule } from "./cache/cache.module";
import { IdleDetectionModule } from "./idle-detection/idle-detection.module";
import { AppActivityModule } from "./app-activity/app-activity.module";
import { UrlActivityModule } from "./url-activity/url-activity.module";
import { BlockedUrlModule } from "./blocked-url/blocked-url.module";

@Module({
  imports: [
    CacheModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get("NODE_ENV") === "production";
        return {
          pinoHttp: {
            level: isProduction ? "info" : "debug",
            transport: isProduction
              ? undefined
              : {
                  target: "pino-pretty",
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: "HH:MM:ss Z",
                    ignore: "pid,hostname",
                  },
                },
            serializers: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                headers: {
                  host: req.headers?.host,
                  "user-agent": req.headers?.["user-agent"],
                },
              }),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              err: (err: any) => ({
                type: err.type,
                message: err.message,
                stack: err.stack,
              }),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            genReqId: (_req: any, res: any) => {
              const existingId = _req.id ?? _req.headers["x-request-id"];
              if (existingId) return existingId;
              const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
              res.setHeader("X-Request-Id", id);
              return id;
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customProps: (_req: any) => ({
              context: "HTTP",
            }),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customLogLevel: (_req: any, res: any, err: any) => {
              if (res.statusCode >= 400 && res.statusCode < 500) {
                return "warn";
              } else if (res.statusCode >= 500 || err) {
                return "error";
              }
              return "info";
            },
          },
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get("NODE_ENV") === "production";
        return [
          {
            ttl: 60000, // 1 minute
            limit: isProduction ? 100 : 1000, // 100 requests per minute in production, 1000 in development
          },
        ];
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TimeEntriesModule,
    EventsModule,
    ScreenshotsModule,
    TeamActivityModule,
    CompaniesModule,
    IdleDetectionModule,
    AppActivityModule,
    UrlActivityModule,
    BlockedUrlModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
