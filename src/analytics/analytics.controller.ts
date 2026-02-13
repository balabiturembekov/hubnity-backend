import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsQueryDto, AnalyticsPeriod } from "./dto/analytics-query.dto";
import { CompareQueryDto } from "./dto/compare-query.dto";
import { ExportQueryDto, ExportFormat } from "./dto/export-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";

@ApiTags("analytics")
@Controller("analytics")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("dashboard")
  @ApiOperation({
    summary: "Данные для дашборда",
    description:
      "Сводная статистика: общие часы, заработок, количество записей, активные пользователи и проекты",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Данные дашборда" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  getDashboard(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getDashboard(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("hours-by-day")
  @ApiOperation({
    summary: "Часы по дням",
    description: "Распределение отработанных часов по дням для графиков",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Часы по дням" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getHoursByDay(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getHoursByDay(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("hours-by-project")
  @ApiOperation({
    summary: "Часы по проектам",
    description: "Распределение отработанных часов и заработка по проектам",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Часы по проектам" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getHoursByProject(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getHoursByProject(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("productivity")
  @ApiOperation({
    summary: "Метрики продуктивности",
    description:
      "Отработанные часы по пользователям, средние значения, заработок",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Метрики продуктивности" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getProductivity(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getProductivity(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("compare")
  @ApiOperation({
    summary: "Сравнение периодов",
    description: "Сравнение отработанных часов между двумя периодами",
  })
  @ApiQuery({ name: "period1", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate1", required: false, type: String })
  @ApiQuery({ name: "endDate1", required: false, type: String })
  @ApiQuery({ name: "period2", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate2", required: false, type: String })
  @ApiQuery({ name: "endDate2", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Сравнение периодов" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  compare(
    @Query() query: CompareQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    const period1: AnalyticsQueryDto = {
      period: query.period1,
      startDate: query.startDate1,
      endDate: query.endDate1,
      userId: query.userId,
      projectId: query.projectId,
    };
    const period2: AnalyticsQueryDto = {
      period: query.period2,
      startDate: query.startDate2,
      endDate: query.endDate2,
      userId: query.userId,
      projectId: query.projectId,
    };
    return this.analyticsService.compare(
      user.companyId,
      user.id,
      user.role,
      period1,
      period2,
    );
  }

  @Get("work-sessions")
  @ApiOperation({
    summary: "Рабочие сессии",
    description:
      "Список рабочих сессий (time entries) с началом, окончанием, длительностью и активностью",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Список рабочих сессий" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getWorkSessions(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getWorkSessions(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("apps-urls")
  @ApiOperation({
    summary: "Приложения и URL",
    description:
      "Агрегация по приложениям и посещённым URL с временем использования",
  })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Приложения и URL" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getAppsUrls(
    @Query() query: AnalyticsQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.analyticsService.getAppsUrls(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }

  @Get("export")
  @ApiOperation({
    summary: "Экспорт аналитики",
    description: "Экспорт данных в CSV",
  })
  @ApiQuery({ name: "format", required: false, enum: ExportFormat })
  @ApiQuery({ name: "period", required: false, enum: AnalyticsPeriod })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "projectId", required: false, type: String })
  @ApiResponse({ status: 200, description: "CSV файл" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  async export(
    @Query() query: ExportQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.analyticsService.exportToCsv(
      user.companyId,
      user.id,
      user.role,
      query,
    );
    res
      .status(HttpStatus.OK)
      .setHeader("Content-Type", "text/csv; charset=utf-8")
      .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  }
}
