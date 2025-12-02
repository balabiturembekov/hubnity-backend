import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
} from "@nestjs/swagger";
import { ProjectsService } from "./projects.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("projects")
@Controller("projects")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать новый проект",
    description:
      "Создает новый проект в компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiResponse({ status: 201, description: "Проект успешно создан" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  create(@Body() createProjectDto: CreateProjectDto, @GetUser() user: any) {
    return this.projectsService.create(createProjectDto, user.companyId);
  }

  @Get()
  @ApiOperation({
    summary: "Получить список всех проектов",
    description: "Возвращает список всех проектов компании",
  })
  @ApiResponse({ status: 200, description: "Список проектов" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findAll(@GetUser() user: any) {
    return this.projectsService.findAll(user.companyId);
  }

  @Get("active")
  @ApiOperation({
    summary: "Получить список активных проектов",
    description: "Возвращает список только активных проектов компании",
  })
  @ApiResponse({ status: 200, description: "Список активных проектов" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findActive(@GetUser() user: any) {
    return this.projectsService.findActive(user.companyId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить проект по ID",
    description: "Возвращает информацию о проекте",
  })
  @ApiParam({ name: "id", description: "ID проекта", type: String })
  @ApiResponse({ status: 200, description: "Информация о проекте" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  findOne(@Param("id") id: string, @GetUser() user: any) {
    return this.projectsService.findOne(id, user.companyId);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary: "Обновить проект",
    description:
      "Обновляет информацию о проекте. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID проекта", type: String })
  @ApiResponse({ status: 200, description: "Проект успешно обновлен" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  update(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @GetUser() user: any,
  ) {
    return this.projectsService.update(id, updateProjectDto, user.companyId);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить проект",
    description:
      "Удаляет проект из компании. Доступно только для OWNER и ADMIN.",
  })
  @ApiParam({ name: "id", description: "ID проекта", type: String })
  @ApiResponse({ status: 204, description: "Проект успешно удален" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  remove(@Param("id") id: string, @GetUser() user: any) {
    return this.projectsService.remove(id, user.companyId);
  }
}
