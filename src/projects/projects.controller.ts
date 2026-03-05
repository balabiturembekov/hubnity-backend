import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { ProjectsService } from "./projects.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
import { GetUser } from "@/auth/decorators/get-user.decorator";
import { MemberRole, ProjectStatus } from "@prisma/client";
import {
  CreateProjectDto,
  AddProjectMemberDto,
  UpdateProjectMemberDto,
  ProjectMemberResponseDto,
  CreateProjectTaskDto,
  UpdateProjectTaskDto,
  ProjectTaskResponseDto,
  CreateProjectBudgetDto,
  UpdateProjectBudgetDto,
  ProjectBudgetResponseDto,
  ProjectFilterDto,
  TaskFilterDto,
  ProjectResponseDto,
} from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";

@ApiTags("projects")
@ApiBearerAuth()
@Controller("projects")
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: "Создать новый проект" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Проект успешно создан",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Неверные входные данные",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Проект с таким именем уже существует",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  @HttpCode(HttpStatus.CREATED)
  async createProject(
    @GetUser("id") userId: string,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.createProject(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: "Получить все проекты" })
  @ApiQuery({
    name: "organizationId",
    required: false,
    description: "ID организации для фильтрации",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ProjectStatus,
    description: "Фильтр по статусу",
  })
  @ApiQuery({
    name: "clientId",
    required: false,
    description: "Фильтр по клиенту",
  })
  @ApiQuery({
    name: "billable",
    required: false,
    type: Boolean,
    description: "Фильтр по биллингу",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Список проектов",
    type: [ProjectResponseDto],
  })
  async getProjects(
    @GetUser("id") userId: string,
    @Query("organizationId") organizationId?: string,
    @Query() filters?: ProjectFilterDto,
  ): Promise<ProjectResponseDto[]> {
    return this.projectsService.getProjects(userId, organizationId, filters);
  }

  @Get(":id")
  @ApiOperation({ summary: "Получить проект по ID" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Детали проекта",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Проект не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Нет доступа к проекту",
  })
  async getProjectById(
    @Param("id", ParseUUIDPipe) projectId: string,
    @GetUser("id") userId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.getProjectById(projectId, userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Обновить проект" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Проект обновлен",
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Проект не найден",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Неверные входные данные",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  async updateProject(
    @Param("id", ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
    @GetUser("id") userId: string,
  ): Promise<ProjectResponseDto> {
    return this.projectsService.updateProject(projectId, dto, userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Удалить проект" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Проект удален",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Проект не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProject(
    @Param("id", ParseUUIDPipe) projectId: string,
    @GetUser("id") userId: string,
  ): Promise<void> {
    await this.projectsService.deleteProject(projectId, userId);
  }

  @Post(":id/members")
  @ApiOperation({ summary: "Добавить участника в проект" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Участник добавлен",
    type: ProjectMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Проект или пользователь не найден",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Пользователь уже является участником",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  @HttpCode(HttpStatus.CREATED)
  async addProjectMember(
    @Param("id", ParseUUIDPipe) projectId: string,
    @Body() dto: AddProjectMemberDto,
    @GetUser("id") userId: string,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectsService.addProjectMember(projectId, dto, userId);
  }

  @Get(":id/members")
  @ApiOperation({ summary: "Получить всех участников проекта" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Список участников",
    type: [ProjectMemberResponseDto],
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Проект не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Нет доступа к проекту",
  })
  async getProjectMembers(
    @Param("id", ParseUUIDPipe) projectId: string,
    @GetUser("id") userId: string,
  ): Promise<ProjectMemberResponseDto[]> {
    return this.projectsService.getProjectMembers(projectId, userId);
  }

  @Get(":id/members/:memberId")
  @ApiOperation({ summary: "Получить участника проекта по ID" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "ID участника",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Данные участника",
    type: ProjectMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Участник не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Нет доступа к проекту",
  })
  async getProjectMemberById(
    @Param("id", ParseUUIDPipe) projectId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @GetUser("id") userId: string,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectsService.getProjectMemberById(
      projectId,
      memberId,
      userId,
    );
  }

  @Put(":id/members/:memberId")
  @ApiOperation({ summary: "Обновить роль участника" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "ID участника",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Роль обновлена",
    type: ProjectMemberResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Участник не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  async updateProjectMember(
    @Param("id", ParseUUIDPipe) projectId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProjectMemberDto,
    @GetUser("id") userId: string,
  ): Promise<ProjectMemberResponseDto> {
    return this.projectsService.updateProjectMember(
      projectId,
      memberId,
      dto,
      userId,
    );
  }

  @Delete(":id/members/:memberId")
  @ApiOperation({ summary: "Удалить участника из проекта" })
  @ApiParam({
    name: "id",
    description: "ID проекта",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "memberId",
    description: "ID участника",
    type: "string",
    format: "uuid",
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Участник удален",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Участник не найден",
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: "Недостаточно прав",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProjectMember(
    @Param("id", ParseUUIDPipe) projectId: string,
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @GetUser("id") userId: string,
  ): Promise<void> {
    await this.projectsService.removeProjectMember(projectId, memberId, userId);
  }
}
