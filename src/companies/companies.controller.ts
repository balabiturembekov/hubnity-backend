import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Param,
  Query,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import {
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  Min,
  Max,
  IsString,
  MinLength,
  MaxLength,
} from "class-validator";
import { CompaniesService } from "./companies.service";
import { ProjectsService } from "../projects/projects.service";
import { UsersService } from "../users/users.service";
import { TimeEntriesService } from "../time-entries/time-entries.service";
import { TeamActivityService } from "../team-activity/team-activity.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";
import { ActivityPeriod } from "../team-activity/dto/team-activity-query.dto";

class UpdateScreenshotSettingsDto {
  @ApiPropertyOptional({
    description: "Включить/выключить автоматические скриншоты",
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  screenshotEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Интервал съемки скриншотов в секундах (30, 60, 300, 600)",
    example: 60,
    enum: [30, 60, 300, 600],
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([30, 60, 300, 600])
  screenshotInterval?: number;
}

class UpdateIdleDetectionSettingsDto {
  @ApiPropertyOptional({
    description: "Включить/выключить детекцию простоя",
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  idleDetectionEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      "Порог простоя в секундах (минимум 60, максимум 3600). Время бездействия до автоматической паузы",
    example: 300,
    type: Number,
    minimum: 60,
    maximum: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Min(60, { message: "idleThreshold must be at least 60 seconds (1 minute)" })
  @Max(3600, { message: "idleThreshold cannot exceed 3600 seconds (1 hour)" })
  idleThreshold?: number;
}

class UpdateCompanyProfileDto {
  @ApiPropertyOptional({
    description: "Название компании",
    example: "ООО Моя Компания",
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Company name must be at least 2 characters" })
  @MaxLength(255, { message: "Company name must not exceed 255 characters" })
  name?: string;

  @ApiPropertyOptional({
    description: "Домен компании (опционально)",
    example: "mycompany.com",
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string | null;
}

@ApiTags("companies")
@Controller("companies")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly projectsService: ProjectsService,
    private readonly usersService: UsersService,
    private readonly timeEntriesService: TimeEntriesService,
    private readonly teamActivityService: TeamActivityService,
  ) {}

  /** Resolve companyId: "me" -> user's company */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private resolveCompanyId(companyId: string, user: any): string {
    if (companyId === "me") return user.companyId;
    if (companyId !== user.companyId) {
      throw new ForbiddenException("Access denied to this organization");
    }
    return companyId;
  }

  @Get("me")
  @ApiOperation({
    summary: "Получить профиль компании",
    description:
      "Возвращает полный профиль компании текущего пользователя (id, name, domain, настройки)",
  })
  @ApiResponse({
    status: 200,
    description: "Профиль компании",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string", example: "ООО Компания" },
        domain: { type: "string", nullable: true },
        screenshotEnabled: { type: "boolean" },
        screenshotInterval: { type: "number" },
        idleDetectionEnabled: { type: "boolean" },
        idleThreshold: { type: "number" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Компания не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getCompanyProfile(@GetUser() user: any) {
    return this.companiesService.getCompanyProfile(user.companyId);
  }

  @Patch("me")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Обновить профиль компании",
    description:
      "Обновляет название и/или домен компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiBody({ type: UpdateCompanyProfileDto })
  @ApiResponse({
    status: 200,
    description: "Профиль компании обновлён",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        name: { type: "string" },
        domain: { type: "string", nullable: true },
        screenshotEnabled: { type: "boolean" },
        screenshotInterval: { type: "number" },
        idleDetectionEnabled: { type: "boolean" },
        idleThreshold: { type: "number" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Компания не найдена" })
  async updateCompanyProfile(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Body() dto: UpdateCompanyProfileDto,
  ) {
    return this.companiesService.updateCompanyProfile(user.companyId, dto);
  }

  @Get("screenshot-settings")
  @ApiOperation({
    summary: "Получить настройки скриншотов компании",
    description: "Возвращает настройки автоматических скриншотов для компании",
  })
  @ApiResponse({
    status: 200,
    description: "Настройки скриншотов",
    schema: {
      type: "object",
      properties: {
        screenshotEnabled: { type: "boolean", example: true },
        screenshotInterval: {
          type: "number",
          example: 60,
          enum: [30, 60, 300, 600],
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getScreenshotSettings(@GetUser() user: any) {
    return this.companiesService.getScreenshotSettings(user.companyId);
  }

  @Patch("screenshot-settings")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Обновить настройки скриншотов компании",
    description:
      "Обновляет настройки автоматических скриншотов. Доступно только для OWNER и ADMIN.",
  })
  @ApiBody({ type: UpdateScreenshotSettingsDto })
  @ApiResponse({
    status: 200,
    description: "Настройки успешно обновлены",
    schema: {
      type: "object",
      properties: {
        screenshotEnabled: { type: "boolean", example: true },
        screenshotInterval: { type: "number", example: 60 },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  async updateScreenshotSettings(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Body() settings: UpdateScreenshotSettingsDto,
  ) {
    return this.companiesService.updateScreenshotSettings(
      user.companyId,
      settings,
    );
  }

  @Get("idle-detection-settings")
  @ApiOperation({
    summary: "Получить настройки детекции простоя компании",
    description: "Возвращает настройки детекции простоя для компании",
  })
  @ApiResponse({
    status: 200,
    description: "Настройки детекции простоя",
    schema: {
      type: "object",
      properties: {
        idleDetectionEnabled: { type: "boolean", example: true },
        idleThreshold: {
          type: "number",
          example: 300,
          description: "Порог простоя в секундах",
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getIdleDetectionSettings(@GetUser() user: any) {
    return this.companiesService.getIdleDetectionSettings(user.companyId);
  }

  @Patch("idle-detection-settings")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Обновить настройки детекции простоя компании",
    description:
      "Обновляет настройки детекции простоя. Доступно только для OWNER и ADMIN.",
  })
  @ApiBody({ type: UpdateIdleDetectionSettingsDto })
  @ApiResponse({
    status: 200,
    description: "Настройки успешно обновлены",
    schema: {
      type: "object",
      properties: {
        idleDetectionEnabled: { type: "boolean", example: true },
        idleThreshold: { type: "number", example: 300 },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  async updateIdleDetectionSettings(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Body() settings: UpdateIdleDetectionSettingsDto,
  ) {
    return this.companiesService.updateIdleDetectionSettings(
      user.companyId,
      settings,
    );
  }

  // --- Hubstaff-style: organization-scoped endpoints ---

  @Get(":companyId/projects")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({
    summary: "Список проектов организации (Hubstaff-style)",
    description:
      "Возвращает проекты компании. Аналог Hubstaff GET /organizations/:id/projects. companyId='me' — текущая компания.",
  })
  @ApiParam({ name: "companyId", description: "ID компании или 'me'" })
  @ApiQuery({
    name: "page_limit",
    required: false,
    description: "Размер страницы (Hubstaff-style)",
    type: Number,
  })
  @ApiQuery({
    name: "page_start_id",
    required: false,
    description: "ID для пагинации (Hubstaff-style)",
    type: String,
  })
  @ApiResponse({ status: 200, description: "Список проектов" })
  @ApiResponse({ status: 403, description: "Нет доступа к организации" })
  async getCompanyProjects(
    @Param("companyId") companyId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const resolvedId = this.resolveCompanyId(companyId, user);
    return this.projectsService.findAll(resolvedId);
  }

  @Get(":companyId/members")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: "Список участников организации (Hubstaff-style)",
    description:
      "Возвращает пользователей компании. Аналог Hubstaff GET /organizations/:id/members. Только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "companyId", description: "ID компании или 'me'" })
  @ApiResponse({ status: 200, description: "Список участников" })
  @ApiResponse({ status: 403, description: "Нет доступа" })
  async getCompanyMembers(
    @Param("companyId") companyId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const resolvedId = this.resolveCompanyId(companyId, user);
    return this.usersService.findAll(resolvedId);
  }

  @Get(":companyId/timesheets")
  @ApiOperation({
    summary: "Табели организации (Hubstaff-style)",
    description:
      "Возвращает записи времени компании. Аналог Hubstaff GET /organizations/:id/timesheets. Сотрудники видят только свои записи.",
  })
  @ApiParam({ name: "companyId", description: "ID компании или 'me'" })
  @ApiQuery({ name: "userId", required: false, description: "Фильтр по пользователю" })
  @ApiQuery({ name: "projectId", required: false, description: "Фильтр по проекту" })
  @ApiQuery({
    name: "page_limit",
    required: false,
    description: "Размер страницы (Hubstaff-style, default 100)",
    type: Number,
  })
  @ApiQuery({
    name: "page_start_id",
    required: false,
    description: "Смещение для пагинации (Hubstaff-style)",
    type: String,
  })
  @ApiQuery({
    name: "time_slot[start]",
    required: false,
    description: "Начало периода (ISO 8601). Фильтр по startTime.",
    example: "2024-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "time_slot[stop]",
    required: false,
    description: "Конец периода (ISO 8601, exclusive). Фильтр по startTime.",
    example: "2024-02-01T00:00:00Z",
  })
  @ApiResponse({
    status: 200,
    description: "Список записей времени с пагинацией",
    schema: {
      type: "object",
      properties: {
        time_entries: { type: "array", items: { type: "object" } },
        pagination: {
          type: "object",
          properties: {
            next_page_start_id: { type: "string", nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Нет доступа" })
  async getCompanyTimesheets(
    @Param("companyId") companyId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("projectId") projectId?: string,
    @Query("page_limit") pageLimit?: string,
    @Query("page_start_id") pageStartId?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Query() query?: any,
  ) {
    const resolvedId = this.resolveCompanyId(companyId, user);
    let parsedLimit = 100;
    if (pageLimit) {
      const parsed = parseInt(pageLimit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) parsedLimit = parsed;
    }
    const filterUserId =
      user.role === UserRole.OWNER ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.MANAGER ||
      user.role === UserRole.SUPER_ADMIN
        ? userId
        : user.id;
    const timeSlotStart = query?.["time_slot[start]"] ?? query?.time_slot?.start;
    const timeSlotStop = query?.["time_slot[stop]"] ?? query?.time_slot?.stop;
    let startDate: Date | undefined;
    let stopDate: Date | undefined;
    if (timeSlotStart) {
      startDate = new Date(timeSlotStart);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException("Invalid time_slot[start] format");
      }
    }
    if (timeSlotStop) {
      stopDate = new Date(timeSlotStop);
      if (isNaN(stopDate.getTime())) {
        throw new BadRequestException("Invalid time_slot[stop] format");
      }
    }
    return this.timeEntriesService.findAllPaginated(
      resolvedId,
      parsedLimit,
      pageStartId,
      filterUserId,
      projectId,
      startDate,
      stopDate,
    );
  }

  @Get(":companyId/activities")
  @ApiOperation({
    summary: "Активность организации (Hubstaff-style)",
    description:
      "Возвращает события активности (start/stop/pause/resume) за период. Аналог Hubstaff GET /organizations/:id/activities. Параметры: time_slot[start], time_slot[stop], user_ids.",
  })
  @ApiParam({ name: "companyId", description: "ID компании или 'me'" })
  @ApiQuery({
    name: "time_slot[start]",
    required: false,
    description: "Начало периода (ISO 8601)",
    example: "2024-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "time_slot[stop]",
    required: false,
    description: "Конец периода (ISO 8601, exclusive)",
    example: "2024-01-02T00:00:00Z",
  })
  @ApiQuery({
    name: "user_ids",
    required: false,
    description: "Фильтр по ID пользователей (через запятую)",
  })
  @ApiResponse({ status: 200, description: "Список активностей" })
  @ApiResponse({ status: 400, description: "Неверный формат даты" })
  @ApiResponse({ status: 403, description: "Нет доступа" })
  async getCompanyActivities(
    @Param("companyId") companyId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Query() query: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const resolvedId = this.resolveCompanyId(companyId, user);
    const timeSlotStart = query["time_slot[start]"] ?? query?.time_slot?.start;
    const timeSlotStop = query["time_slot[stop]"] ?? query?.time_slot?.stop;
    const userIds = query.user_ids;
    const start = timeSlotStart ? new Date(timeSlotStart) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stop = timeSlotStop ? new Date(timeSlotStop) : new Date();
    if (isNaN(start.getTime()) || isNaN(stop.getTime())) {
      throw new BadRequestException("Invalid time_slot format");
    }
    const ids = userIds && String(userIds).trim() ? String(userIds).split(",").map((s) => s.trim()).filter(Boolean) : undefined;
    return this.timeEntriesService.findActivitiesByTimeSlot(
      resolvedId,
      start,
      stop,
      ids,
    );
  }

  @Get(":companyId/activities/daily")
  @ApiOperation({
    summary: "Ежедневная активность (Hubstaff-style)",
    description:
      "Возвращает сводку активности по дням. Аналог Hubstaff GET /organizations/:id/activities/daily. Параметры: date[start], date[stop].",
  })
  @ApiParam({ name: "companyId", description: "ID компании или 'me'" })
  @ApiQuery({
    name: "date[start]",
    required: false,
    description: "Начальная дата (YYYY-MM-DD)",
    example: "2024-01-01",
  })
  @ApiQuery({
    name: "date[stop]",
    required: false,
    description: "Конечная дата включительно (YYYY-MM-DD)",
    example: "2024-01-31",
  })
  @ApiResponse({ status: 200, description: "Сводка по дням" })
  @ApiResponse({ status: 403, description: "Нет доступа" })
  async getCompanyActivitiesDaily(
    @Param("companyId") companyId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @Query() query: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const dateStart = query["date[start]"] ?? query?.date?.start;
    const dateStop = query["date[stop]"] ?? query?.date?.stop;
    const resolvedId = this.resolveCompanyId(companyId, user);
    const startStr = dateStart || new Date().toISOString().slice(0, 10);
    const stopStr = dateStop || startStr;
    const teamActivity = await this.teamActivityService.getTeamActivity(
      resolvedId,
      user.id,
      user.role,
      {
        period: ActivityPeriod.CUSTOM,
        startDate: startStr,
        endDate: stopStr,
      },
    );
    return { period: teamActivity.period, members: teamActivity.members };
  }
}
