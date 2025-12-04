import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
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
} from "@nestjs/swagger";
import { PinoLogger } from "nestjs-pino";
import { BlockedUrlService } from "./blocked-url.service";
import { CreateBlockedUrlDto } from "./dto/create-blocked-url.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { isUUID } from "class-validator";

@ApiTags("blocked-urls")
@Controller("blocked-urls")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class BlockedUrlController {
  constructor(
    private readonly blockedUrlService: BlockedUrlService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BlockedUrlController.name);
  }

  @Get()
  @ApiOperation({
    summary: "Получить список заблокированных URL",
    description:
      "Возвращает список всех заблокированных URL для компании. Только для администраторов.",
  })
  @ApiResponse({
    status: 200,
    description: "Список заблокированных URL",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          companyId: { type: "string", example: "uuid" },
          url: {
            type: "string",
            nullable: true,
            example: "https://facebook.com",
          },
          domain: { type: "string", nullable: true, example: "facebook.com" },
          pattern: {
            type: "string",
            nullable: true,
            example: ".*\\.(facebook|twitter)\\.com.*",
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа (только для администраторов)",
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async findAll(@GetUser() user: any) {
    return this.blockedUrlService.findAll(user.companyId, user.role);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать заблокированный URL",
    description:
      "Создает правило блокировки URL. Можно блокировать по точному URL, домену или regex паттерну. Только для администраторов.",
  })
  @ApiResponse({
    status: 201,
    description: "Заблокированный URL успешно создан",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        companyId: { type: "string", example: "uuid" },
        url: {
          type: "string",
          nullable: true,
          example: "https://facebook.com",
        },
        domain: { type: "string", nullable: true, example: "facebook.com" },
        pattern: {
          type: "string",
          nullable: true,
          example: ".*\\.(facebook|twitter)\\.com.*",
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Неверные данные запроса или дубликат",
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа (только для администраторов)",
  })
  async create(
    @Body() dto: CreateBlockedUrlDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.blockedUrlService.create(dto, user.companyId, user.role);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Удалить заблокированный URL",
    description: "Удаляет правило блокировки URL. Только для администраторов.",
  })
  @ApiParam({
    name: "id",
    description: "ID заблокированного URL",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Заблокированный URL успешно удален",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа (только для администраторов)",
  })
  @ApiResponse({
    status: 404,
    description: "Заблокированный URL не найден",
  })
  async delete(
    @Param("id") id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    if (!isUUID(id)) {
      throw new BadRequestException("Invalid blocked URL ID format");
    }
    return this.blockedUrlService.delete(id, user.companyId, user.role);
  }
}
