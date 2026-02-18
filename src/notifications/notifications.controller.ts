import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { NotificationQueryDto } from "./dto/notification-query.dto";
import { MarkReadDto } from "./dto/mark-read.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { isUUID } from "class-validator";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "Список уведомлений",
    description:
      "Возвращает уведомления текущего пользователя с пагинацией. Поддерживает фильтр по непрочитанным.",
  })
  @ApiResponse({
    status: 200,
    description: "Список уведомлений",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              userId: { type: "string" },
              companyId: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "TIME_ENTRY_APPROVED",
                  "TIME_ENTRY_REJECTED",
                  "TIME_ENTRY_PENDING_APPROVAL",
                  "USER_ADDED",
                ],
              },
              title: { type: "string" },
              message: { type: "string" },
              readAt: { type: "string", format: "date-time", nullable: true },
              metadata: { type: "object", nullable: true },
              createdAt: { type: "string", format: "date-time" },
            },
          },
        },
        total: { type: "number" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async findAll(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query() query: NotificationQueryDto,
  ) {
    return this.notificationsService.findAll(user.id, user.companyId, {
      unreadOnly: query.unreadOnly,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("unread-count")
  @ApiOperation({
    summary: "Количество непрочитанных",
    description: "Возвращает число непрочитанных уведомлений (для badge).",
  })
  @ApiResponse({
    status: 200,
    description: "Количество непрочитанных",
    schema: {
      type: "object",
      properties: {
        count: { type: "number", example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async getUnreadCount(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const count = await this.notificationsService.getUnreadCount(
      user.id,
      user.companyId,
    );
    return { count };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить уведомление по ID",
    description: "Возвращает одно уведомление. Доступно только владельцу.",
  })
  @ApiParam({ name: "id", description: "ID уведомления (UUID)" })
  @ApiResponse({ status: 200, description: "Уведомление" })
  @ApiResponse({ status: 400, description: "Неверный формат ID" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Уведомление не найдено" })
  async findOne(
    @Param("id") id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    if (!isUUID(id, "4")) {
      throw new BadRequestException("Invalid notification ID format");
    }
    return this.notificationsService.findOne(id, user.id, user.companyId);
  }

  @Patch("read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Отметить как прочитанное",
    description:
      "Отмечает уведомления как прочитанные. Без ids — отмечает все непрочитанные. С ids — указанные уведомления.",
  })
  @ApiBody({ type: MarkReadDto })
  @ApiResponse({
    status: 200,
    description: "Результат",
    schema: {
      type: "object",
      properties: {
        updatedCount: { type: "number", example: 3 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async markAsRead(
    @Body() dto: MarkReadDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.notificationsService.markAsRead(
      user.id,
      user.companyId,
      dto.ids,
    );
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Отметить одно уведомление как прочитанное",
  })
  @ApiParam({ name: "id", description: "ID уведомления (UUID)" })
  @ApiResponse({
    status: 200,
    description: "Результат",
    schema: {
      type: "object",
      properties: {
        updatedCount: { type: "number", example: 1 },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверный формат ID" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Уведомление не найдено" })
  async markOneAsRead(
    @Param("id") id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    if (!isUUID(id, "4")) {
      throw new BadRequestException("Invalid notification ID format");
    }
    const result = await this.notificationsService.markAsRead(
      user.id,
      user.companyId,
      [id],
    );
    if (result.updatedCount === 0) {
      throw new NotFoundException("Notification not found");
    }
    return result;
  }
}
