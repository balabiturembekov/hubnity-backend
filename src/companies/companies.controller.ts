import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import {
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  Min,
  Max,
} from "class-validator";
import { CompaniesService } from "./companies.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

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

@ApiTags("companies")
@Controller("companies")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

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
    @GetUser() user: any,
    @Body() settings: UpdateIdleDetectionSettingsDto,
  ) {
    return this.companiesService.updateIdleDetectionSettings(
      user.companyId,
      settings,
    );
  }
}
