import { WebSocketGateway, WebSocketServer, SubscribeMessage, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: (origin, callback) => {
      // Get allowed origins (same logic as main.ts)
      const getAllowedOrigins = (): string[] => {
        if (process.env.NODE_ENV === 'production') {
          const origins: string[] = [];
          
          if (process.env.FRONTEND_URL) {
            origins.push(process.env.FRONTEND_URL);
            const urlWithoutProtocol = process.env.FRONTEND_URL.replace(/^https?:\/\//, '');
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
            const additional = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
            origins.push(...additional);
          }
          
          return origins.length > 0 ? [...new Set(origins)] : [];
        } else {
          return [
            process.env.FRONTEND_URL || 'http://localhost:3002',
            'http://localhost:3000',
            'http://localhost:3002',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3002',
            'ws://localhost:3000',
            'ws://localhost:3002',
            'ws://127.0.0.1:3000',
            'ws://127.0.0.1:3002',
          ].filter(Boolean);
        }
      };
      
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin
      if (!origin) {
        console.log('WebSocket CORS: Allowing connection with no origin');
        return callback(null, true);
      }
      
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        console.log(`WebSocket CORS: Allowing origin: ${origin}`);
        callback(null, true);
      } else {
        console.warn(`WebSocket CORS: Blocked origin: ${origin}`);
        console.warn(`WebSocket CORS: Allowed origins are:`, allowedOrigins);
        callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
      }
    },
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger('EventsGateway');
  private connectedClients = new Map<string, Socket>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_SECRET') || 'secret',
      });

      let companyId = payload.companyId;

      if (!companyId) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { companyId: true },
        });

        if (!user) {
          throw new Error('User not found');
        }

        companyId = user.companyId;
      }

      client.data.userId = payload.sub;
      client.data.email = payload.email || 'unknown';
      client.data.companyId = companyId;

      this.connectedClients.set(client.id, client);

      this.logger.log(`Client ${client.id} connected (User: ${payload.email || payload.sub}, Company: ${companyId})`);

      client.join(`user:${payload.sub}`);
      client.join(`company:${companyId}`);

      this.server.to(`company:${companyId}`).emit('user:connected', {
        userId: payload.sub,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      this.logger.error(`Authentication error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId && client.data.companyId) {
      this.logger.log(`Client ${client.id} disconnected (User: ${client.data.userId})`);

      this.server.to(`company:${client.data.companyId}`).emit('user:disconnected', {
        userId: client.data.userId,
        timestamp: new Date().toISOString(),
      });
    }

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  broadcastStatsUpdate(stats: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('stats:update', {
        ...stats,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = stats?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastStatsUpdate called without companyId, extracted from stats: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('stats:update', {
          ...stats,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastStatsUpdate called without companyId and cannot extract from stats. Not broadcasting.`);
      }
    }
  }

  broadcastActivity(activity: any, companyId?: string) {
    try {
      if (companyId) {
        const timestamp = activity.timestamp || new Date().toISOString();
        this.server.to(`company:${companyId}`).emit('activity:new', {
          ...activity,
          timestamp,
        });
      } else {
        const extractedCompanyId = activity?.companyId || activity?.user?.companyId;
        if (extractedCompanyId) {
          this.logger.warn(`broadcastActivity called without companyId, extracted from activity: ${extractedCompanyId}`);
          const timestamp = activity.timestamp || new Date().toISOString();
          this.server.to(`company:${extractedCompanyId}`).emit('activity:new', {
            ...activity,
            timestamp,
          });
        } else {
          this.logger.error(`broadcastActivity called without companyId and cannot extract from activity. Not broadcasting.`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error broadcasting activity: ${error.message}`, error);
    }
  }

  broadcastTimeEntryUpdate(timeEntry: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('time-entry:update', {
        ...timeEntry,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = timeEntry?.user?.companyId || timeEntry?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastTimeEntryUpdate called without companyId, extracted from timeEntry: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('time-entry:update', {
          ...timeEntry,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastTimeEntryUpdate called without companyId and cannot extract from timeEntry. Not broadcasting.`);
      }
    }
  }

  notifyUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  broadcastScreenshotSettingsUpdate(settings: any, companyId?: string) {
    if (companyId) {
      this.server.to(`company:${companyId}`).emit('screenshot-settings:update', {
        ...settings,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = settings?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastScreenshotSettingsUpdate called without companyId, extracted from settings: ${extractedCompanyId}`);
        this.server.to(`company:${extractedCompanyId}`).emit('screenshot-settings:update', {
          ...settings,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastScreenshotSettingsUpdate called without companyId and cannot extract from settings. Not broadcasting.`);
      }
    }
  }

  broadcastIdleDetection(data: any, companyId?: string) {
    if (companyId) {
      // Отправляем уведомление конкретному пользователю
      if (data.userId) {
        this.server.to(`user:${data.userId}`).emit('idle:detected', {
          ...data,
          timestamp: new Date().toISOString(),
        });
      }
      // Также отправляем в компанию для админов
      this.server.to(`company:${companyId}`).emit('idle:detected', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    } else {
      const extractedCompanyId = data?.companyId;
      if (extractedCompanyId) {
        this.logger.warn(`broadcastIdleDetection called without companyId, extracted from data: ${extractedCompanyId}`);
        if (data.userId) {
          this.server.to(`user:${data.userId}`).emit('idle:detected', {
            ...data,
            timestamp: new Date().toISOString(),
          });
        }
        this.server.to(`company:${extractedCompanyId}`).emit('idle:detected', {
          ...data,
          timestamp: new Date().toISOString(),
        });
      } else {
        this.logger.error(`broadcastIdleDetection called without companyId and cannot extract from data. Not broadcasting.`);
      }
    }
  }
}

