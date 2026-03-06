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
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { MemberRole } from "@prisma/client";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary: "Получить список всех пользователей",
    description:
      "Возвращает список всех пользователей компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({
    status: 200,
    description: "Список пользователей",
    schema: {
      type: "array",
      items: {
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
    },
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findAll(@GetUser() user: any) {
    return this.usersService.findAll(user.companyId);
  }

  //   @Patch("me")
  //   @ApiOperation({
  //     summary: "Обновить свой профиль",
  //     description: "Обновляет информацию о текущем пользователе",
  //   })
  //   @ApiResponse({
  //     status: 200,
  //     description: "Профиль успешно обновлен",
  //     schema: {
  //       type: "object",
  //       properties: {
  //         id: { type: "string", example: "uuid" },
  //         name: { type: "string", example: "Иван Иванов" },
  //         email: { type: "string", example: "ivan@example.com" },
  //         role: {
  //           type: "string",
  //           enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
  //           example: "EMPLOYEE",
  //         },
  //         status: {
  //           type: "string",
  //           enum: ["ACTIVE", "INACTIVE"],
  //           example: "ACTIVE",
  //         },
  //         avatar: { type: "string", nullable: true },
  //         hourlyRate: { type: "number", nullable: true, example: 25.5 },
  //         companyId: { type: "string", example: "uuid" },
  //         createdAt: { type: "string", format: "date-time" },
  //         updatedAt: { type: "string", format: "date-time" },
  //       },
  //     },
  //   })
  //   @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  //   @ApiResponse({ status: 401, description: "Не авторизован" })
  //   @ApiResponse({ status: 404, description: "Пользователь не найден" })
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   updateMyProfile(@GetUser() user: any, @Body() updateUserDto: UpdateUserDto) {
  //     if (updateUserDto.role && updateUserDto.role !== user.role) {
  //       delete updateUserDto.role;
  //     }
  //     if ("companyId" in updateUserDto) {
  //       delete updateUserDto.companyId;
  //     }
  //     return this.usersService.update(
  //       user.id,
  //       updateUserDto,
  //       user.companyId,
  //       user.role,
  //     );
  //   }

  //   @Get(":id")
  //   @ApiOperation({
  //     summary: "Получить пользователя по ID",
  //     description:
  //       "Возвращает информацию о пользователе. Сотрудники могут видеть только свой профиль.",
  //   })
  //   @ApiParam({ name: "id", description: "ID пользователя", type: String })
  //   @ApiResponse({
  //     status: 200,
  //     description: "Информация о пользователе",
  //     schema: {
  //       type: "object",
  //       properties: {
  //         id: { type: "string", example: "uuid" },
  //         name: { type: "string", example: "Иван Иванов" },
  //         email: { type: "string", example: "ivan@example.com" },
  //         role: {
  //           type: "string",
  //           enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
  //           example: "EMPLOYEE",
  //         },
  //         status: {
  //           type: "string",
  //           enum: ["ACTIVE", "INACTIVE"],
  //           example: "ACTIVE",
  //         },
  //         avatar: { type: "string", nullable: true },
  //         hourlyRate: { type: "number", nullable: true, example: 25.5 },
  //         companyId: { type: "string", example: "uuid" },
  //         createdAt: { type: "string", format: "date-time" },
  //         updatedAt: { type: "string", format: "date-time" },
  //       },
  //     },
  //   })
  //   @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  //   @ApiResponse({ status: 404, description: "Пользователь не найден" })
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   findOne(@Param("id") id: string, @GetUser() user: any) {
  //     if (
  //       user.role !== UserRole.OWNER &&
  //       user.role !== UserRole.ADMIN &&
  //       user.role !== UserRole.SUPER_ADMIN
  //     ) {
  //       if (id !== user.id) {
  //         throw new ForbiddenException("You can only view your own profile");
  //       }
  //     }
  //     return this.usersService.findOne(id, user.companyId);
  //   }

  //   @Patch(":id")
  //   @UseGuards(RolesGuard)
  //   @Roles(UserRole.OWNER, UserRole.ADMIN)
  //   @ApiOperation({
  //     summary: "Обновить пользователя",
  //     description:
  //       "Обновляет информацию о пользователе. Доступно только для OWNER и ADMIN.",
  //   })
  //   @ApiParam({ name: "id", description: "ID пользователя", type: String })
  //   @ApiResponse({
  //     status: 200,
  //     description: "Пользователь успешно обновлен",
  //     schema: {
  //       type: "object",
  //       properties: {
  //         id: { type: "string", example: "uuid" },
  //         name: { type: "string", example: "Иван Иванов" },
  //         email: { type: "string", example: "ivan@example.com" },
  //         role: {
  //           type: "string",
  //           enum: ["SUPER_ADMIN", "OWNER", "ADMIN", "EMPLOYEE"],
  //           example: "EMPLOYEE",
  //         },
  //         status: {
  //           type: "string",
  //           enum: ["ACTIVE", "INACTIVE"],
  //           example: "ACTIVE",
  //         },
  //         avatar: { type: "string", nullable: true },
  //         hourlyRate: { type: "number", nullable: true, example: 25.5 },
  //         companyId: { type: "string", example: "uuid" },
  //         createdAt: { type: "string", format: "date-time" },
  //         updatedAt: { type: "string", format: "date-time" },
  //       },
  //     },
  //   })
  //   @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  //   @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  //   @ApiResponse({ status: 404, description: "Пользователь не найден" })
  //   update(
  //     @Param("id") id: string,
  //     @Body() updateUserDto: UpdateUserDto,
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     @GetUser() user: any,
  //   ) {
  //     return this.usersService.update(
  //       id,
  //       updateUserDto,
  //       user.companyId,
  //       user.role,
  //       user.id,
  //     );
  //   }

  //   @Delete(":id")
  //   @UseGuards(RolesGuard)
  //   @Roles(UserRole.OWNER, UserRole.ADMIN)
  //   @HttpCode(HttpStatus.NO_CONTENT)
  //   @ApiOperation({
  //     summary: "Удалить пользователя",
  //     description:
  //       "Удаляет пользователя из компании. Нельзя удалить свой собственный аккаунт. Доступно только для OWNER и ADMIN.",
  //   })
  //   @ApiParam({ name: "id", description: "ID пользователя", type: String })
  //   @ApiResponse({ status: 204, description: "Пользователь успешно удален" })
  //   @ApiResponse({
  //     status: 403,
  //     description: "Недостаточно прав доступа или попытка удалить свой аккаунт",
  //   })
  //   @ApiResponse({ status: 404, description: "Пользователь не найден" })
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   remove(@Param("id") id: string, @GetUser() user: any) {
  //     return this.usersService.remove(id, user.companyId, user.role, user.id);
  //   }
}
