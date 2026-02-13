import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
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
import { TimeEntriesService } from "./time-entries.service";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { RejectTimeEntryDto } from "./dto/reject-time-entry.dto";
import { BulkApproveDto } from "./dto/bulk-approve.dto";
import { BulkRejectDto } from "./dto/bulk-reject.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("time-entries")
@Controller("time-entries")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать запись времени",
    description:
      "Создает новую запись времени. Сотрудники могут создавать записи только для себя. Для сотрудников проект обязателен.",
  })
  @ApiResponse({
    status: 201,
    description: "Запись времени успешно создана",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        duration: { type: "number", example: 0 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: {
          type: "string",
          enum: ["RUNNING", "PAUSED", "STOPPED"],
          example: "RUNNING",
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
            avatar: { type: "string", nullable: true },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      "Неверные данные запроса или у пользователя уже есть активная запись",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({
    status: 404,
    description: "Пользователь или проект не найден",
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(@Body() createTimeEntryDto: CreateTimeEntryDto, @GetUser() user: any) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      if (createTimeEntryDto.userId !== user.id) {
        throw new ForbiddenException(
          "You can only create time entries for yourself",
        );
      }
    }
    return this.timeEntriesService.create(
      createTimeEntryDto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Получить список записей времени",
    description:
      "Возвращает список записей времени. Администраторы могут фильтровать по userId и projectId. Сотрудники видят только свои записи.",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiQuery({
    name: "projectId",
    required: false,
    description: "ID проекта для фильтрации",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Максимальное количество записей (максимум 1000, по умолчанию 100)",
    type: Number,
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Список записей времени",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          userId: { type: "string", example: "uuid" },
          projectId: { type: "string", nullable: true, example: "uuid" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time", nullable: true },
          duration: { type: "number", example: 3600 },
          description: {
            type: "string",
            nullable: true,
            example: "Разработка функционала",
          },
          status: {
            type: "string",
            enum: ["RUNNING", "PAUSED", "STOPPED"],
            example: "STOPPED",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Иван Иванов" },
              email: { type: "string", example: "ivan@example.com" },
            },
          },
          project: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Проект" },
              color: { type: "string", example: "#3b82f6" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findAll(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("projectId") projectId?: string,
    @Query("limit") limit?: string,
  ) {
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }

    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findAll(
        user.companyId,
        user.id,
        projectId,
        parsedLimit,
      );
    }
    return this.timeEntriesService.findAll(
      user.companyId,
      userId,
      projectId,
      parsedLimit,
    );
  }

  @Get("active")
  @ApiOperation({
    summary: "Получить активные записи времени",
    description:
      "Возвращает список активных (RUNNING или PAUSED) записей времени",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Список активных записей времени",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          userId: { type: "string", example: "uuid" },
          projectId: { type: "string", nullable: true, example: "uuid" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time", nullable: true },
          duration: { type: "number", example: 1800 },
          description: {
            type: "string",
            nullable: true,
            example: "Разработка функционала",
          },
          status: {
            type: "string",
            enum: ["RUNNING", "PAUSED"],
            example: "RUNNING",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Иван Иванов" },
              email: { type: "string", example: "ivan@example.com" },
            },
          },
          project: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Проект" },
              color: { type: "string", example: "#3b82f6" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findActive(@GetUser() user: any, @Query("userId") userId?: string) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findActive(user.companyId, user.id);
    }
    return this.timeEntriesService.findActive(user.companyId, userId);
  }

  @Get("my")
  @ApiOperation({
    summary: "Получить свои записи времени",
    description: "Возвращает список всех записей времени текущего пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Список записей времени пользователя",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          userId: { type: "string", example: "uuid" },
          projectId: { type: "string", nullable: true, example: "uuid" },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time", nullable: true },
          duration: { type: "number", example: 3600 },
          description: {
            type: "string",
            nullable: true,
            example: "Разработка функционала",
          },
          status: {
            type: "string",
            enum: ["RUNNING", "PAUSED", "STOPPED"],
            example: "STOPPED",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Иван Иванов" },
              email: { type: "string", example: "ivan@example.com" },
            },
          },
          project: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Проект" },
              color: { type: "string", example: "#3b82f6" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findMyEntries(@GetUser() user: any) {
    return this.timeEntriesService.findAll(user.companyId, user.id);
  }

  @Get("activities")
  @ApiOperation({
    summary: "Получить историю активности",
    description: "Возвращает историю активности (START, STOP, PAUSE, RESUME)",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Лимит записей (максимум 1000, по умолчанию 100)",
    type: Number,
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "История активности",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          userId: { type: "string", example: "uuid" },
          projectId: { type: "string", nullable: true, example: "uuid" },
          type: {
            type: "string",
            enum: ["START", "STOP", "PAUSE", "RESUME"],
            example: "START",
          },
          timestamp: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Иван Иванов" },
              email: { type: "string", example: "ivan@example.com" },
            },
          },
          project: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string", example: "uuid" },
              name: { type: "string", example: "Проект" },
              color: { type: "string", example: "#3b82f6" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findActivities(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
  ) {
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }

    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findAllActivities(
        user.companyId,
        user.id,
        parsedLimit,
      );
    }
    return this.timeEntriesService.findAllActivities(
      user.companyId,
      userId,
      parsedLimit,
    );
  }

  @Get("pending")
  @ApiOperation({
    summary: "Получить записи на утверждение",
    description:
      "Возвращает записи времени со статусом PENDING (остановленные, ожидающие утверждения). Админы могут фильтровать по userId.",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Максимальное количество записей (максимум 1000, по умолчанию 100)",
    type: Number,
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Список записей на утверждение",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          userId: { type: "string", example: "uuid" },
          projectId: { type: "string", nullable: true },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time", nullable: true },
          duration: { type: "number", example: 3600 },
          description: { type: "string", nullable: true },
          status: { type: "string", enum: ["STOPPED"], example: "STOPPED" },
          approvalStatus: {
            type: "string",
            enum: ["PENDING", "APPROVED", "REJECTED"],
            example: "PENDING",
          },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              email: { type: "string" },
            },
          },
          project: {
            type: "object",
            nullable: true,
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              color: { type: "string" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  findPending(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
  ) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      if (userId && userId !== user.id) {
        throw new ForbiddenException(
          "You can only view your own pending entries",
        );
      }
      const effectiveUserId = user.id;
      let parsedLimit = 100;
      if (limit) {
        const parsed = parseInt(limit, 10);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
          parsedLimit = parsed;
        }
      }
      return this.timeEntriesService.findPending(
        user.companyId,
        effectiveUserId,
        parsedLimit,
      );
    }
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }
    return this.timeEntriesService.findPending(
      user.companyId,
      userId,
      parsedLimit,
    );
  }

  @Post("bulk-approve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBody({ type: BulkApproveDto })
  @ApiOperation({
    summary: "Массовое утверждение записей",
    description: "Утверждает несколько записей времени. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({
    status: 200,
    description: "Результат массового утверждения",
    schema: {
      type: "object",
      properties: {
        approvedCount: { type: "number", example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  bulkApprove(
    @Body() dto: BulkApproveDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.bulkApprove(
      dto.ids,
      user.companyId,
      user.id,
    );
  }

  @Post("bulk-reject")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBody({ type: BulkRejectDto })
  @ApiOperation({
    summary: "Массовое отклонение записей",
    description:
      "Отклоняет несколько записей времени с опциональным комментарием. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({
    status: 200,
    description: "Результат массового отклонения",
    schema: {
      type: "object",
      properties: {
        rejectedCount: { type: "number", example: 3 },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  bulkReject(
    @Body() dto: BulkRejectDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.bulkReject(
      dto.ids,
      user.companyId,
      user.id,
      dto.rejectionComment,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить запись времени по ID",
    description: "Возвращает информацию о записи времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Информация о записи времени",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        duration: { type: "number", example: 3600 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: {
          type: "string",
          enum: ["RUNNING", "PAUSED", "STOPPED"],
          example: "STOPPED",
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
            avatar: { type: "string", nullable: true },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findOne(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.findOne(id, user.companyId);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Обновить запись времени",
    description: "Обновляет информацию о записи времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Запись времени успешно обновлена",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        duration: { type: "number", example: 3600 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: {
          type: "string",
          enum: ["RUNNING", "PAUSED", "STOPPED"],
          example: "RUNNING",
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  update(
    @Param("id") id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.update(
      id,
      updateTimeEntryDto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Post(":id/approve")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: "Утвердить запись времени",
    description:
      "Утверждает запись времени со статусом PENDING. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Запись времени успешно утверждена",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        approvalStatus: { type: "string", enum: ["APPROVED"], example: "APPROVED" },
        approvedBy: { type: "string", example: "uuid" },
        approvedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Запись не в статусе PENDING" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  approve(
    @Param("id") id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.approve(
      id,
      user.companyId,
      user.id,
    );
  }

  @Post(":id/reject")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBody({ type: RejectTimeEntryDto })
  @ApiOperation({
    summary: "Отклонить запись времени",
    description:
      "Отклоняет запись времени со статусом PENDING с опциональным комментарием. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Запись времени успешно отклонена",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        approvalStatus: { type: "string", enum: ["REJECTED"], example: "REJECTED" },
        approvedBy: { type: "string", example: "uuid" },
        approvedAt: { type: "string", format: "date-time" },
        rejectionComment: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Запись не в статусе PENDING" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectTimeEntryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.reject(
      id,
      user.companyId,
      user.id,
      dto.rejectionComment,
    );
  }

  @Put(":id/stop")
  @ApiOperation({
    summary: "Остановить таймер",
    description:
      "Останавливает активную запись времени и вычисляет финальную длительность",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Таймер успешно остановлен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time" },
        duration: { type: "number", example: 3600 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: { type: "string", enum: ["STOPPED"], example: "STOPPED" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
            avatar: { type: "string", nullable: true },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Запись времени уже остановлена" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stop(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.stop(id, user.companyId, user.id, user.role);
  }

  @Put(":id/pause")
  @ApiOperation({
    summary: "Приостановить таймер",
    description: "Приостанавливает активную запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Таймер успешно приостановлен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        duration: { type: "number", example: 1800 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: { type: "string", enum: ["PAUSED"], example: "PAUSED" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
            avatar: { type: "string", nullable: true },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Запись времени не может быть приостановлена",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pause(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.pause(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Put(":id/resume")
  @ApiOperation({
    summary: "Возобновить таймер",
    description: "Возобновляет приостановленную запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({
    status: 200,
    description: "Таймер успешно возобновлен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        projectId: { type: "string", nullable: true, example: "uuid" },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        duration: { type: "number", example: 1800 },
        description: {
          type: "string",
          nullable: true,
          example: "Разработка функционала",
        },
        status: { type: "string", enum: ["RUNNING"], example: "RUNNING" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
            avatar: { type: "string", nullable: true },
          },
        },
        project: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Проект" },
            color: { type: "string", example: "#3b82f6" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Запись времени не может быть возобновлена",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resume(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.resume(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить запись времени",
    description: "Удаляет запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 204, description: "Запись времени успешно удалена" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.remove(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }
}
