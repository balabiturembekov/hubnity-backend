import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

const corsLogger = new Logger("EventsGatewayCORS");

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Get allowed origins (same logic as main.ts)
      const getAllowedOrigins = (): string[] => {
        if (process.env.NODE_ENV === "production") {
          const origins: string[] = [];

          if (process.env.FRONTEND_URL) {
            origins.push(process.env.FRONTEND_URL);
            const urlWithoutProtocol = process.env.FRONTEND_URL.replace(
              /^https?:\/\//,
              "",
            );
            origins.push(`http://${urlWithoutProtocol}`);
            origins.push(`https://${urlWithoutProtocol}`);
          }

          if (process.env.FRONTEND_IP) {
            const ip = process.env.FRONTEND_IP;
            origins.push(`http://${ip}`);
            origins.push(`http://${ip}:3002`);
            origins.push(`https://${ip}`);
            origins.push(`https://${ip}:3002`);
          }

          if (process.env.ALLOWED_ORIGINS) {
            const additional = process.env.ALLOWED_ORIGINS.split(",")
              .map((o) => o.trim())
              .filter(Boolean);
            origins.push(...additional);
          }

          return origins.length > 0 ? [...new Set(origins)] : [];
        } else {
          return [
            process.env.FRONTEND_URL || "http://localhost:3002",
            "http://localhost:3000",
            "http://localhost:3002",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3002",
            "ws://localhost:3000",
            "ws://localhost:3002",
            "ws://127.0.0.1:3000",
            "ws://127.0.0.1:3002",
          ].filter(Boolean);
        }
      };

      const allowedOrigins = getAllowedOrigins();

      // Allow requests with no origin only in development
      if (!origin) {
        if (process.env.NODE_ENV === "production") {
          corsLogger.warn(
            "WebSocket CORS: Blocking connection with no origin in production",
          );
          callback(new Error("Origin is required in production"));
          return;
        }
        corsLogger.debug("WebSocket CORS: Allowing connection with no origin");
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        corsLogger.debug(`WebSocket CORS: Allowing origin: ${origin}`);
        callback(null, true);
      } else {
        corsLogger.warn(`WebSocket CORS: Blocked origin: ${origin}`);
        corsLogger.debug(
          `WebSocket CORS: Allowed origins are: ${allowedOrigins.join(", ")}`,
        );
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    credentials: true,
  },
  namespace: "/",
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger("EventsGateway");
  private connectedClients = new Map<string, Socket>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get("JWT_SECRET") || "secret",
      });

      // Validate UUID format for payload.sub
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!payload.sub || !uuidRegex.test(payload.sub)) {
        this.logger.error(
          `Invalid user ID format in token for client ${client.id}`,
        );
        client.disconnect();
        return;
      }

      let companyId = payload.companyId;

      if (!companyId) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            companyId: true,
            status: true,
          },
        });

        if (!user) {
          this.logger.error(
            `User not found for client ${client.id}, userId: ${payload.sub}`,
          );
          client.disconnect();
          return;
        }

        // Check user status
        if (user.status !== "ACTIVE") {
          this.logger.warn(
            `Inactive user tried to connect: ${payload.sub}, status: ${user.status}`,
          );
          client.disconnect();
          return;
        }

        companyId = user.companyId;
      }

      // Validate UUID format for companyId
      if (!companyId || !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid company ID format for client ${client.id}, companyId: ${companyId}`,
        );
        client.disconnect();
        return;
      }

      // Check company existence
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });

      if (!company) {
        this.logger.error(
          `Company not found for client ${client.id}, companyId: ${companyId}`,
        );
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      client.data.email = payload.email || "unknown";
      client.data.companyId = companyId;

      this.connectedClients.set(client.id, client);

      this.logger.log(
        `Client ${client.id} connected (User: ${payload.email || payload.sub}, Company: ${companyId})`,
      );

      client.join(`user:${payload.sub}`);
      client.join(`company:${companyId}`);

      this.server.to(`company:${companyId}`).emit("user:connected", {
        userId: payload.sub,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Authentication error for client ${client.id}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId && client.data.companyId) {
      this.logger.log(
        `Client ${client.id} disconnected (User: ${client.data.userId})`,
      );

      this.server
        .to(`company:${client.data.companyId}`)
        .emit("user:disconnected", {
          userId: client.data.userId,
          timestamp: new Date().toISOString(),
        });
    }

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage("ping")
  handlePing() {
    return { event: "pong", data: { timestamp: new Date().toISOString() } };
  }

  broadcastStatsUpdate(stats: unknown, companyId?: string) {
    try {
      // Validate UUID format for companyId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (companyId && !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid companyId format in broadcastStatsUpdate: ${companyId}`,
        );
        return;
      }

      if (companyId) {
        this.server.to(`company:${companyId}`).emit("stats:update", {
          ...(stats as Record<string, unknown>),
          timestamp: new Date().toISOString(),
        });
      } else {
        const statsObj = stats as { companyId?: string } | null | undefined;
        const extractedCompanyId = statsObj?.companyId;
        if (extractedCompanyId && uuidRegex.test(extractedCompanyId)) {
          this.logger.warn(
            `broadcastStatsUpdate called without companyId, extracted from stats: ${extractedCompanyId}`,
          );
          this.server.to(`company:${extractedCompanyId}`).emit("stats:update", {
            ...(stats as Record<string, unknown>),
            timestamp: new Date().toISOString(),
          });
        } else {
          this.logger.error(
            `broadcastStatsUpdate called without companyId and cannot extract from stats. Not broadcasting.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error broadcasting stats update: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  broadcastActivity(activity: unknown, companyId?: string) {
    try {
      // Validate UUID format for companyId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (companyId && !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid companyId format in broadcastActivity: ${companyId}`,
        );
        return;
      }

      const activityObj = activity as
        | {
            timestamp?: string;
            companyId?: string;
            user?: { companyId?: string };
          }
        | null
        | undefined;

      if (companyId) {
        const timestamp = activityObj?.timestamp || new Date().toISOString();
        this.server.to(`company:${companyId}`).emit("activity:new", {
          ...(activity as Record<string, unknown>),
          timestamp,
        });
      } else {
        const extractedCompanyId =
          activityObj?.companyId || activityObj?.user?.companyId;
        if (extractedCompanyId && uuidRegex.test(extractedCompanyId)) {
          this.logger.warn(
            `broadcastActivity called without companyId, extracted from activity: ${extractedCompanyId}`,
          );
          const timestamp = activityObj?.timestamp || new Date().toISOString();
          this.server.to(`company:${extractedCompanyId}`).emit("activity:new", {
            ...(activity as Record<string, unknown>),
            timestamp,
          });
        } else {
          this.logger.error(
            `broadcastActivity called without companyId and cannot extract from activity. Not broadcasting.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error broadcasting activity: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Throttle: avoid spamming identical status within 2 min per user */
  private lastTimeEntryBroadcast = new Map<string, number>();
  private static readonly BROADCAST_THROTTLE_MS = 2 * 60 * 1000;

  broadcastTimeEntryUpdate(timeEntry: unknown, companyId?: string) {
    try {
      // Validate UUID format for companyId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (companyId && !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid companyId format in broadcastTimeEntryUpdate: ${companyId}`,
        );
        return;
      }

      const entry = timeEntry as
        | {
            userId?: string;
            status?: string;
            projectId?: string | null;
            duration?: number;
            [k: string]: unknown;
          }
        | null
        | undefined;

      const userId = entry?.userId;
      const status = entry?.status ?? "STOPPED";
      const throttleKey = userId ? `${userId}:${status}` : null;
      if (throttleKey) {
        const now = Date.now();
        const last = this.lastTimeEntryBroadcast.get(throttleKey) ?? 0;
        if (now - last < EventsGateway.BROADCAST_THROTTLE_MS) {
          this.logger.debug(
            { userId, status, throttleKey },
            "Skipping time-entry broadcast (throttled)",
          );
          return;
        }
        this.lastTimeEntryBroadcast.set(throttleKey, now);
      }

      const serverTime = new Date().toISOString();
      const payload = {
        ...(timeEntry as Record<string, unknown>),
        userId: entry?.userId,
        status: entry?.status,
        projectId: entry?.projectId ?? null,
        serverTime,
        currentDuration: entry?.duration ?? 0,
        timestamp: serverTime,
      };

      if (companyId) {
        this.server.to(`company:${companyId}`).emit("time-entry:update", payload);
      } else {
        const entryObj = timeEntry as
          | { user?: { companyId?: string }; companyId?: string }
          | null
          | undefined;
        const extractedCompanyId =
          entryObj?.user?.companyId || entryObj?.companyId;
        if (extractedCompanyId && uuidRegex.test(extractedCompanyId)) {
          this.logger.warn(
            `broadcastTimeEntryUpdate called without companyId, extracted from timeEntry: ${extractedCompanyId}`,
          );
          this.server
            .to(`company:${extractedCompanyId}`)
            .emit("time-entry:update", payload);
        } else {
          this.logger.error(
            `broadcastTimeEntryUpdate called without companyId and cannot extract from timeEntry. Not broadcasting.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error broadcasting time entry update: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  notifyUser(userId: string, event: string, data: unknown) {
    // Validate UUID format for userId
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      this.logger.error(
        `Invalid userId format in notifyUser: ${userId}, event: ${event}`,
      );
      return;
    }

    try {
      this.server.to(`user:${userId}`).emit(event, {
        ...(data as Record<string, unknown>),
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error notifying user ${userId} with event ${event}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  broadcastScreenshotSettingsUpdate(settings: unknown, companyId?: string) {
    try {
      // Validate UUID format for companyId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (companyId && !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid companyId format in broadcastScreenshotSettingsUpdate: ${companyId}`,
        );
        return;
      }

      if (companyId) {
        this.server
          .to(`company:${companyId}`)
          .emit("screenshot-settings:update", {
            ...(settings as Record<string, unknown>),
            timestamp: new Date().toISOString(),
          });
      } else {
        const settingsObj = settings as
          | { companyId?: string }
          | null
          | undefined;
        const extractedCompanyId = settingsObj?.companyId;
        if (extractedCompanyId && uuidRegex.test(extractedCompanyId)) {
          this.logger.warn(
            `broadcastScreenshotSettingsUpdate called without companyId, extracted from settings: ${extractedCompanyId}`,
          );
          this.server
            .to(`company:${extractedCompanyId}`)
            .emit("screenshot-settings:update", {
              ...(settings as Record<string, unknown>),
              timestamp: new Date().toISOString(),
            });
        } else {
          this.logger.error(
            `broadcastScreenshotSettingsUpdate called without companyId and cannot extract from settings. Not broadcasting.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error broadcasting screenshot settings update: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  broadcastIdleDetection(data: unknown, companyId?: string) {
    try {
      // Validate UUID format for companyId
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (companyId && !uuidRegex.test(companyId)) {
        this.logger.error(
          `Invalid companyId format in broadcastIdleDetection: ${companyId}`,
        );
        return;
      }

      const dataObj = data as
        | { userId?: string; companyId?: string }
        | null
        | undefined;

      if (companyId) {
        // Отправляем уведомление конкретному пользователю
        if (dataObj?.userId && uuidRegex.test(dataObj.userId)) {
          this.server.to(`user:${dataObj.userId}`).emit("idle:detected", {
            ...(data as Record<string, unknown>),
            timestamp: new Date().toISOString(),
          });
        }
        // Также отправляем в компанию для админов
        this.server.to(`company:${companyId}`).emit("idle:detected", {
          ...(data as Record<string, unknown>),
          timestamp: new Date().toISOString(),
        });
      } else {
        const extractedCompanyId = dataObj?.companyId;
        if (extractedCompanyId && uuidRegex.test(extractedCompanyId)) {
          this.logger.warn(
            `broadcastIdleDetection called without companyId, extracted from data: ${extractedCompanyId}`,
          );
          if (dataObj?.userId && uuidRegex.test(dataObj.userId)) {
            this.server.to(`user:${dataObj.userId}`).emit("idle:detected", {
              ...(data as Record<string, unknown>),
              timestamp: new Date().toISOString(),
            });
          }
          this.server
            .to(`company:${extractedCompanyId}`)
            .emit("idle:detected", {
              ...(data as Record<string, unknown>),
              timestamp: new Date().toISOString(),
            });
        } else {
          this.logger.error(
            `broadcastIdleDetection called without companyId and cannot extract from data. Not broadcasting.`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Error broadcasting idle detection: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
