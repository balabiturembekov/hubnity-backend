import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { PinoLogger } from "nestjs-pino";
import { UrlActivityService } from "./url-activity.service";
import { CreateUrlActivityDto } from "./dto/create-url-activity.dto";
import { BatchCreateUrlActivityDto } from "./dto/batch-create-url-activity.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { isUUID } from "class-validator";

@ApiTags("url-activity")
@Controller("url-activity")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class UrlActivityController {
  constructor(
    private readonly urlActivityService: UrlActivityService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UrlActivityController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать запись о использовании URL",
    description:
      "Создает запись о том, какой URL использовался и сколько времени на него потрачено. Сотрудники могут создавать записи только для своих time entries. Заблокированные URL будут отклонены.",
  })
  @ApiResponse({
    status: 201,
    description: "Запись о URL успешно создана",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        timeEntryId: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        url: { type: "string", example: "https://github.com/user/repo" },
        domain: { type: "string", example: "github.com" },
        title: {
          type: "string",
          nullable: true,
          example: "GitHub Repository",
        },
        timeSpent: { type: "number", example: 1800 },
        startTime: { type: "string", format: "date-time" },
        endTime: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
        timeEntry: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            description: { type: "string", nullable: true },
            status: {
              type: "string",
              enum: ["RUNNING", "PAUSED", "STOPPED"],
            },
          },
        },
        user: {
          type: "object",
          properties: {
            id: { type: "string", example: "uuid" },
            name: { type: "string", example: "Иван Иванов" },
            email: { type: "string", example: "ivan@example.com" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные запроса",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа или URL заблокирован",
  })
  @ApiResponse({
    status: 404,
    description: "Time entry не найден",
  })
  async create(
    @Body() dto: CreateUrlActivityDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.urlActivityService.create(
      dto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Post("batch")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Batch создание записей о URL",
    description:
      "Создает несколько записей о URL за один запрос. Максимум 100 записей за раз. Заблокированные URL будут пропущены.",
  })
  @ApiResponse({
    status: 201,
    description: "Записи о URL успешно созданы",
    schema: {
      type: "object",
      properties: {
        count: { type: "number", example: 5 },
        skipped: { type: "number", example: 2 },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              timeEntryId: { type: "string", example: "uuid" },
              userId: { type: "string", example: "uuid" },
              url: { type: "string", example: "https://github.com/user/repo" },
              domain: { type: "string", example: "github.com" },
              title: {
                type: "string",
                nullable: true,
                example: "GitHub Repository",
              },
              timeSpent: { type: "number", example: 1800 },
              startTime: { type: "string", format: "date-time" },
              endTime: { type: "string", format: "date-time", nullable: true },
              createdAt: { type: "string", format: "date-time" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные запроса",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа",
  })
  @ApiResponse({
    status: 404,
    description: "Один или несколько time entries не найдены",
  })
  async createBatch(
    @Body() dto: BatchCreateUrlActivityDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.urlActivityService.createBatch(
      dto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get("time-entry/:timeEntryId/stats")
  @ApiOperation({
    summary: "Получить статистику по URL для time entry",
    description:
      "Возвращает статистику использования URL для указанной записи времени, сгруппированную по доменам.",
  })
  @ApiParam({
    name: "timeEntryId",
    description: "ID записи времени",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Статистика по URL",
    schema: {
      type: "object",
      properties: {
        timeEntryId: { type: "string", example: "uuid" },
        totalTime: { type: "number", example: 3600 },
        totalActivities: { type: "number", example: 5 },
        domains: {
          type: "array",
          items: {
            type: "object",
            properties: {
              domain: { type: "string", example: "github.com" },
              totalTime: { type: "number", example: 1800 },
              count: { type: "number", example: 2 },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "uuid" },
                    url: {
                      type: "string",
                      example: "https://github.com/user/repo",
                    },
                    title: {
                      type: "string",
                      nullable: true,
                      example: "GitHub Repository",
                    },
                    timeSpent: { type: "number", example: 900 },
                    startTime: { type: "string", format: "date-time" },
                    endTime: {
                      type: "string",
                      format: "date-time",
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа",
  })
  @ApiResponse({
    status: 404,
    description: "Time entry не найден",
  })
  async getStatsByTimeEntry(
    @Param("timeEntryId") timeEntryId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    if (!isUUID(timeEntryId)) {
      throw new BadRequestException("Invalid timeEntryId format");
    }
    return this.urlActivityService.getStatsByTimeEntry(
      timeEntryId,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get("user/:userId/stats")
  @ApiOperation({
    summary: "Получить статистику по URL для пользователя",
    description:
      "Возвращает статистику использования URL для указанного пользователя за период. Можно фильтровать по датам.",
  })
  @ApiParam({
    name: "userId",
    description: "ID пользователя",
    type: String,
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    format: "date-time",
    description: "Начальная дата (ISO 8601)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    format: "date-time",
    description: "Конечная дата (ISO 8601)",
  })
  @ApiResponse({
    status: 200,
    description: "Статистика по URL пользователя",
    schema: {
      type: "object",
      properties: {
        userId: { type: "string", example: "uuid" },
        period: {
          type: "object",
          properties: {
            startDate: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
            endDate: {
              type: "string",
              format: "date-time",
              nullable: true,
            },
          },
        },
        totalTime: { type: "number", example: 7200 },
        totalActivities: { type: "number", example: 10 },
        domains: {
          type: "array",
          items: {
            type: "object",
            properties: {
              domain: { type: "string", example: "github.com" },
              totalTime: { type: "number", example: 3600 },
              count: { type: "number", example: 5 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверный ID пользователя или формат даты",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа",
  })
  @ApiResponse({
    status: 404,
    description: "Пользователь не найден",
  })
  async getUserStats(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Param("userId") userId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const startDateObj = startDate ? new Date(startDate) : undefined;
    const endDateObj = endDate ? new Date(endDate) : undefined;

    if (startDate && startDateObj && isNaN(startDateObj.getTime())) {
      throw new BadRequestException("Invalid startDate format");
    }

    if (endDate && endDateObj && isNaN(endDateObj.getTime())) {
      throw new BadRequestException("Invalid endDate format");
    }

    if (!isUUID(userId)) {
      throw new BadRequestException("Invalid userId format");
    }

    return this.urlActivityService.getUserStats(
      userId,
      user.companyId,
      startDateObj,
      endDateObj,
      user.id,
      user.role,
    );
  }
}
