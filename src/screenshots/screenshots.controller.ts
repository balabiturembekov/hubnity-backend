import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
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
import { ScreenshotsService } from "./screenshots.service";
import { UploadScreenshotDto } from "./dto/upload-screenshot.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";

@ApiTags("screenshots")
@Controller("screenshots")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class ScreenshotsController {
  constructor(
    private readonly screenshotsService: ScreenshotsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ScreenshotsController.name);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Загрузить скриншот",
    description:
      "Загружает скриншот для записи времени. Изображение должно быть в формате base64 (data:image/png;base64,...). Максимальный размер: 50MB.",
  })
  @ApiResponse({
    status: 201,
    description: "Скриншот успешно загружен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        timeEntryId: { type: "string", example: "uuid" },
        imageUrl: { type: "string", example: "/uploads/screenshots/xxx.jpg" },
        thumbnailUrl: {
          type: "string",
          example: "/uploads/thumbnails/xxx.jpg",
        },
        timestamp: { type: "string", format: "date-time" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные запроса или превышен размер файла",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upload(@Body() dto: UploadScreenshotDto, @GetUser() user: any) {
    this.logger.debug(
      {
        timeEntryId: dto.timeEntryId,
        imageDataLength: dto.imageData?.length || 0,
        userId: user.id,
        companyId: user.companyId,
      },
      "Upload request received",
    );

    try {
      const result = await this.screenshotsService.upload(
        dto,
        user.companyId,
        user.id,
      );
      this.logger.info({ screenshotId: result.id }, "Upload successful");
      return result;
    } catch (error: unknown) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timeEntryId: dto.timeEntryId,
          userId: user.id,
        },
        "Upload error",
      );
      throw error;
    }
  }

  @Get("time-entry/:timeEntryId")
  @ApiOperation({
    summary: "Получить скриншоты для записи времени",
    description:
      "Возвращает список всех скриншотов для указанной записи времени",
  })
  @ApiParam({
    name: "timeEntryId",
    description: "ID записи времени",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Максимальное количество скриншотов (максимум 1000, по умолчанию 100)",
    type: Number,
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "Список скриншотов",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          timeEntryId: { type: "string", example: "uuid" },
          imageUrl: { type: "string", example: "/uploads/screenshots/xxx.jpg" },
          thumbnailUrl: {
            type: "string",
            example: "/uploads/thumbnails/xxx.jpg",
          },
          timestamp: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  async findByTimeEntry(
    @Param("timeEntryId") timeEntryId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
    @Query("limit") limit?: string,
  ) {
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }

    return this.screenshotsService.findByTimeEntry(
      timeEntryId,
      user.companyId,
      user.id,
      parsedLimit,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить скриншот",
    description: "Удаляет скриншот",
  })
  @ApiParam({ name: "id", description: "ID скриншота", type: String })
  @ApiResponse({ status: 204, description: "Скриншот успешно удален" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Скриншот не найден" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async delete(@Param("id") id: string, @GetUser() user: any) {
    return this.screenshotsService.delete(id, user.companyId, user.id);
  }
}
