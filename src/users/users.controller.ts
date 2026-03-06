import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
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
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ICurrentUser } from "./user-interface";
import { UserRole } from "@prisma/client";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch("me")
  @ApiOperation({
    summary: "Обновить свой профиль",
    description: "Обновляет информацию о текущем пользователе",
  })
  @ApiResponse({
    status: 200,
    description: "Профиль успешно обновлен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Иван Иванов" },
        email: { type: "string", example: "ivan@example.com" },
        role: {
          type: "string",
          enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
          example: "EMPLOYEE",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE"],
          example: "ACTIVE",
        },
        avatar: { type: "string", nullable: true },
        hourlyRate: { type: "number", nullable: true, example: 25.5 },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  updateMyProfile(
    @GetUser() user: ICurrentUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(user.id, updateUserDto);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить пользователя по ID",
    description:
      "Возвращает информацию о пользователе. Сотрудники могут видеть только свой профиль.",
  })
  @ApiParam({ name: "id", description: "ID пользователя", type: String })
  @ApiResponse({
    status: 200,
    description: "Информация о пользователе",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Иван Иванов" },
        email: { type: "string", example: "ivan@example.com" },
        role: {
          type: "string",
          enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
          example: "EMPLOYEE",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE"],
          example: "ACTIVE",
        },
        avatar: { type: "string", nullable: true },
        hourlyRate: { type: "number", nullable: true, example: 25.5 },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  findOne(@Param("id") id: string, @GetUser() user: ICurrentUser) {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (id !== user.id) {
        throw new ForbiddenException("You can only view your own profile");
      }
    }
    return this.usersService.findOne(id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить пользователя",
    description:
      "Удаляет пользователя из компании. Нельзя удалить свой собственный аккаунт. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID пользователя", type: String })
  @ApiResponse({ status: 204, description: "Пользователь успешно удален" })
  @ApiResponse({
    status: 403,
    description: "Недостаточно прав доступа или попытка удалить свой аккаунт",
  })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  remove(@Param("id") id: string, @GetUser() user: ICurrentUser) {
    if (!id) {
      throw new BadRequestException("User ID is required");
    }
    if (user.id === id) {
      throw new ForbiddenException("You cannot delete your own account");
    }
    return this.usersService.remove(id);
  }
}
