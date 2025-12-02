import {
  Controller,
  Get,
  Post,
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
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать нового пользователя",
    description:
      "Создает нового пользователя в компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({ status: 201, description: "Пользователь успешно создан" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  create(@Body() createUserDto: CreateUserDto, @GetUser() user: any) {
    return this.usersService.create(createUserDto, user.companyId, user.role);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Получить список всех пользователей",
    description:
      "Возвращает список всех пользователей компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({ status: 200, description: "Список пользователей" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  findAll(@GetUser() user: any) {
    return this.usersService.findAll(user.companyId);
  }

  @Get("me")
  @ApiOperation({
    summary: "Получить свой профиль",
    description: "Возвращает информацию о текущем пользователе",
  })
  @ApiResponse({ status: 200, description: "Информация о пользователе" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  getMyProfile(@GetUser() user: any) {
    return this.usersService.findOne(user.id, user.companyId);
  }

  @Patch("me")
  @ApiOperation({
    summary: "Обновить свой профиль",
    description: "Обновляет информацию о текущем пользователе",
  })
  @ApiResponse({ status: 200, description: "Профиль успешно обновлен" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  updateMyProfile(@GetUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    if (updateUserDto.role && updateUserDto.role !== user.role) {
      delete updateUserDto.role;
    }
    if ("companyId" in updateUserDto) {
      delete updateUserDto.companyId;
    }
    return this.usersService.update(
      user.id,
      updateUserDto,
      user.companyId,
      user.role,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить пользователя по ID",
    description:
      "Возвращает информацию о пользователе. Сотрудники могут видеть только свой профиль.",
  })
  @ApiParam({ name: "id", description: "ID пользователя", type: String })
  @ApiResponse({ status: 200, description: "Информация о пользователе" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  findOne(@Param("id") id: string, @GetUser() user: any) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      if (id !== user.id) {
        throw new ForbiddenException("You can only view your own profile");
      }
    }
    return this.usersService.findOne(id, user.companyId);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Обновить пользователя",
    description:
      "Обновляет информацию о пользователе. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID пользователя", type: String })
  @ApiResponse({ status: 200, description: "Пользователь успешно обновлен" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Пользователь не найден" })
  update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser() user: any,
  ) {
    return this.usersService.update(
      id,
      updateUserDto,
      user.companyId,
      user.role,
      user.id,
    );
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
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
  remove(@Param("id") id: string, @GetUser() user: any) {
    return this.usersService.remove(id, user.companyId, user.role, user.id);
  }
}
