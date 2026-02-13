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
  @ApiResponse({
    status: 201,
    description: "Проект успешно создан",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Новый проект" },
        description: {
          type: "string",
          nullable: true,
          example: "Описание проекта",
        },
        color: { type: "string", example: "#3b82f6" },
        clientName: { type: "string", nullable: true, example: "Клиент" },
        budget: { type: "number", nullable: true, example: 100000 },
        status: {
          type: "string",
          enum: ["ACTIVE", "ARCHIVED"],
          example: "ACTIVE",
        },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(@Body() createProjectDto: CreateProjectDto, @GetUser() user: any) {
    return this.projectsService.create(createProjectDto, user.companyId);
  }

  @Get()
  @ApiOperation({
    summary: "Получить список всех проектов",
    description: "Возвращает список всех проектов компании",
  })
  @ApiResponse({
    status: 200,
    description: "Список проектов",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          name: { type: "string", example: "Новый проект" },
          description: {
            type: "string",
            nullable: true,
            example: "Описание проекта",
          },
          color: { type: "string", example: "#3b82f6" },
          clientName: { type: "string", nullable: true, example: "Клиент" },
          budget: { type: "number", nullable: true, example: 100000 },
          status: {
            type: "string",
            enum: ["ACTIVE", "ARCHIVED"],
            example: "ACTIVE",
          },
          companyId: { type: "string", example: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findAll(@GetUser() user: any) {
    return this.projectsService.findAll(user.companyId);
  }

  @Get("active")
  @ApiOperation({
    summary: "Получить список активных проектов",
    description: "Возвращает список только активных проектов компании",
  })
  @ApiResponse({
    status: 200,
    description: "Список активных проектов",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", example: "uuid" },
          name: { type: "string", example: "Новый проект" },
          description: {
            type: "string",
            nullable: true,
            example: "Описание проекта",
          },
          color: { type: "string", example: "#3b82f6" },
          clientName: { type: "string", nullable: true, example: "Клиент" },
          budget: { type: "number", nullable: true, example: 100000 },
          status: {
            type: "string",
            enum: ["ACTIVE"],
            example: "ACTIVE",
          },
          companyId: { type: "string", example: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  findActive(@GetUser() user: any) {
    return this.projectsService.findActive(user.companyId);
  }

  @Get(":id/budget-status")
  @ApiOperation({
    summary: "Статус бюджета проекта",
    description:
      "Возвращает использованный бюджет, оставшийся и процент использования",
  })
  @ApiParam({ name: "id", description: "ID проекта", type: String })
  @ApiResponse({
    status: 200,
    description: "Статус бюджета",
    schema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        projectName: { type: "string" },
        budget: { type: "number", nullable: true },
        used: { type: "number", nullable: true },
        remaining: { type: "number", nullable: true },
        usedPercent: { type: "number", nullable: true },
        entriesCount: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getBudgetStatus(@Param("id") id: string, @GetUser() user: any) {
    return this.projectsService.getBudgetStatus(id, user.companyId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить проект по ID",
    description: "Возвращает информацию о проекте",
  })
  @ApiParam({ name: "id", description: "ID проекта", type: String })
  @ApiResponse({
    status: 200,
    description: "Информация о проекте",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Новый проект" },
        description: {
          type: "string",
          nullable: true,
          example: "Описание проекта",
        },
        color: { type: "string", example: "#3b82f6" },
        clientName: { type: "string", nullable: true, example: "Клиент" },
        budget: { type: "number", nullable: true, example: 100000 },
        status: {
          type: "string",
          enum: ["ACTIVE", "ARCHIVED"],
          example: "ACTIVE",
        },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  @ApiResponse({
    status: 200,
    description: "Проект успешно обновлен",
    schema: {
      type: "object",
      properties: {
        id: { type: "string", example: "uuid" },
        name: { type: "string", example: "Новый проект" },
        description: {
          type: "string",
          nullable: true,
          example: "Описание проекта",
        },
        color: { type: "string", example: "#3b82f6" },
        clientName: { type: "string", nullable: true, example: "Клиент" },
        budget: { type: "number", nullable: true, example: 100000 },
        status: {
          type: "string",
          enum: ["ACTIVE", "ARCHIVED"],
          example: "ACTIVE",
        },
        companyId: { type: "string", example: "uuid" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Проект не найден" })
  update(
    @Param("id") id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remove(@Param("id") id: string, @GetUser() user: any) {
    return this.projectsService.remove(id, user.companyId);
  }
}
