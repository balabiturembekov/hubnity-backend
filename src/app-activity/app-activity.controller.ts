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
import { AppActivityService } from "./app-activity.service";
import { CreateAppActivityDto } from "./dto/create-app-activity.dto";
import { BatchCreateAppActivityDto } from "./dto/batch-create-app-activity.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";

@ApiTags("app-activity")
@Controller("app-activity")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class AppActivityController {
  constructor(
    private readonly appActivityService: AppActivityService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AppActivityController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать запись о использовании приложения",
    description:
      "Создает запись о том, какое приложение использовалось и сколько времени на него потрачено. Сотрудники могут создавать записи только для своих time entries.",
  })
  @ApiResponse({
    status: 201,
    description: "Запись о приложении успешно создана",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        timeEntryId: { type: "string", example: "uuid" },
        userId: { type: "string", example: "uuid" },
        appName: { type: "string", example: "Visual Studio Code" },
        windowTitle: {
          type: "string",
          nullable: true,
          example: "index.ts - Hubnity",
        },
        timeSpent: { type: "number", example: 3600 },
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
    description: "Недостаточно прав доступа",
  })
  @ApiResponse({
    status: 404,
    description: "Time entry не найден",
  })
  async create(
    @Body() dto: CreateAppActivityDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.appActivityService.create(
      dto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Post("batch")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Batch создание записей о приложениях",
    description:
      "Создает несколько записей о приложениях за один запрос. Максимум 100 записей за раз.",
  })
  @ApiResponse({
    status: 201,
    description: "Записи о приложениях успешно созданы",
    schema: {
      type: "object",
      properties: {
        count: { type: "number", example: 5 },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "uuid" },
              timeEntryId: { type: "string", example: "uuid" },
              userId: { type: "string", example: "uuid" },
              appName: { type: "string", example: "Visual Studio Code" },
              windowTitle: {
                type: "string",
                nullable: true,
                example: "index.ts - Hubnity",
              },
              timeSpent: { type: "number", example: 3600 },
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
    @Body() dto: BatchCreateAppActivityDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.appActivityService.createBatch(
      dto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get("time-entry/:timeEntryId/stats")
  @ApiOperation({
    summary: "Получить статистику по приложениям для time entry",
    description:
      "Возвращает статистику использования приложений для указанной записи времени, сгруппированную по приложениям.",
  })
  @ApiParam({
    name: "timeEntryId",
    description: "ID записи времени",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Статистика по приложениям",
    schema: {
      type: "object",
      properties: {
        timeEntryId: { type: "string", example: "uuid" },
        totalTime: { type: "number", example: 7200 },
        totalActivities: { type: "number", example: 5 },
        apps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              appName: { type: "string", example: "Visual Studio Code" },
              totalTime: { type: "number", example: 3600 },
              count: { type: "number", example: 2 },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", example: "uuid" },
                    windowTitle: {
                      type: "string",
                      nullable: true,
                      example: "index.ts - Hubnity",
                    },
                    timeSpent: { type: "number", example: 1800 },
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
    return this.appActivityService.getStatsByTimeEntry(
      timeEntryId,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get("user/:userId/stats")
  @ApiOperation({
    summary: "Получить статистику по приложениям для пользователя",
    description:
      "Возвращает статистику использования приложений для указанного пользователя за период. Можно фильтровать по датам.",
  })
  @ApiParam({
    name: "userId",
    description: "ID пользователя",
    type: String,
  })
  @ApiQuery({
    name: "startDate",
    description: "Начальная дата периода (ISO 8601)",
    required: false,
    type: String,
    example: "2024-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "endDate",
    description: "Конечная дата периода (ISO 8601)",
    required: false,
    type: String,
    example: "2024-01-31T23:59:59.999Z",
  })
  @ApiResponse({
    status: 200,
    description: "Статистика по приложениям пользователя",
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
        totalTime: { type: "number", example: 86400 },
        totalActivities: { type: "number", example: 50 },
        apps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              appName: { type: "string", example: "Visual Studio Code" },
              totalTime: { type: "number", example: 36000 },
              count: { type: "number", example: 20 },
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
      throw new Error("Invalid startDate format");
    }

    if (endDate && endDateObj && isNaN(endDateObj.getTime())) {
      throw new Error("Invalid endDate format");
    }

    return this.appActivityService.getUserStats(
      userId,
      user.companyId,
      startDateObj,
      endDateObj,
      user.id,
      user.role,
    );
  }
}
