import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import {
  CreateNotificationParams,
  NotificationMetadata,
} from "./notifications.types";
import { NotificationType } from "@prisma/client";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  /**
   * Создаёт уведомление и отправляет real-time через WebSocket
   */
  async create(params: CreateNotificationParams) {
    const { userId, companyId, type, title, message, metadata } = params;

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        companyId,
        type,
        title,
        message,
        metadata: metadata ? (metadata as object) : undefined,
      },
    });

    try {
      this.eventsGateway.notifyUser(userId, "notification:new", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
        createdAt: notification.createdAt,
      });
    } catch (err) {
      this.logger.warn(
        { err, notificationId: notification.id, userId },
        "Failed to send real-time notification (saved in DB)",
      );
    }

    return notification;
  }

  /**
   * Создаёт уведомления для нескольких пользователей (например, админам компании)
   */
  private readonly MAX_BULK_RECIPIENTS = 100;

  async createForUsers(
    userIds: string[],
    companyId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: NotificationMetadata,
  ) {
    const uniqueIds = [...new Set(userIds)].slice(
      0,
      this.MAX_BULK_RECIPIENTS,
    );
    if (uniqueIds.length === 0) return [];

    const notifications = await this.prisma.notification.createManyAndReturn({
      data: uniqueIds.map((userId) => ({
        userId,
        companyId,
        type,
        title,
        message,
        metadata: metadata ? (metadata as object) : undefined,
      })),
    });

    for (const n of notifications) {
      try {
        this.eventsGateway.notifyUser(n.userId, "notification:new", {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          metadata: n.metadata,
          createdAt: n.createdAt,
        });
      } catch (err) {
        this.logger.warn(
          { err, notificationId: n.id, userId: n.userId },
          "Failed to send real-time notification (saved in DB)",
        );
      }
    }

    return notifications;
  }

  /**
   * Список уведомлений текущего пользователя
   */
  async findAll(
    userId: string,
    companyId: string,
    options: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ) {
    const { unreadOnly = false, limit = 20, offset = 0 } = options;
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    const where = {
      userId,
      companyId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        skip: safeOffset,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: notifications,
      total,
      limit: safeLimit,
      offset: safeOffset,
    };
  }

  /**
   * Количество непрочитанных
   */
  async getUnreadCount(userId: string, companyId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        companyId,
        readAt: null,
      },
    });
  }

  /**
   * Отметить как прочитанное.
   * Без ids — только непрочитанные. С ids — указанные (даже если уже прочитаны).
   */
  async markAsRead(
    userId: string,
    companyId: string,
    ids?: string[],
  ): Promise<{ updatedCount: number }> {
    const where: {
      userId: string;
      companyId: string;
      id?: { in: string[] };
      readAt?: null;
    } = {
      userId,
      companyId,
    };

    if (ids && ids.length > 0) {
      where.id = { in: [...new Set(ids)] };
    } else {
      where.readAt = null;
    }

    const result = await this.prisma.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count };
  }

  /**
   * Получить одно уведомление по ID (с проверкой доступа)
   */
  async findOne(id: string, userId: string, companyId: string) {
    if (!UUID_REGEX.test(id)) {
      throw new NotFoundException("Notification not found");
    }

    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        userId,
        companyId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return notification;
  }
}
