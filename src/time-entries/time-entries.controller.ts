import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  Query,
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
  ApiQuery,
} from "@nestjs/swagger";
import { TimeEntriesService } from "./time-entries.service";
import { CreateTimeEntryDto } from "./dto/create-time-entry.dto";
import { UpdateTimeEntryDto } from "./dto/update-time-entry.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

@ApiTags("time-entries")
@Controller("time-entries")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Создать запись времени",
    description:
      "Создает новую запись времени. Сотрудники могут создавать записи только для себя. Для сотрудников проект обязателен.",
  })
  @ApiResponse({ status: 201, description: "Запись времени успешно создана" })
  @ApiResponse({
    status: 400,
    description:
      "Неверные данные запроса или у пользователя уже есть активная запись",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({
    status: 404,
    description: "Пользователь или проект не найден",
  })
  create(@Body() createTimeEntryDto: CreateTimeEntryDto, @GetUser() user: any) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      if (createTimeEntryDto.userId !== user.id) {
        throw new ForbiddenException(
          "You can only create time entries for yourself",
        );
      }
    }
    return this.timeEntriesService.create(
      createTimeEntryDto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Get()
  @ApiOperation({
    summary: "Получить список записей времени",
    description:
      "Возвращает список записей времени. Администраторы могут фильтровать по userId и projectId. Сотрудники видят только свои записи.",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiQuery({
    name: "projectId",
    required: false,
    description: "ID проекта для фильтрации",
    type: String,
  })
  @ApiResponse({ status: 200, description: "Список записей времени" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findAll(
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("projectId") projectId?: string,
  ) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findAll(
        user.companyId,
        user.id,
        projectId,
      );
    }
    return this.timeEntriesService.findAll(user.companyId, userId, projectId);
  }

  @Get("active")
  @ApiOperation({
    summary: "Получить активные записи времени",
    description:
      "Возвращает список активных (RUNNING или PAUSED) записей времени",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiResponse({ status: 200, description: "Список активных записей времени" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findActive(@GetUser() user: any, @Query("userId") userId?: string) {
    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findActive(user.companyId, user.id);
    }
    return this.timeEntriesService.findActive(user.companyId, userId);
  }

  @Get("my")
  @ApiOperation({
    summary: "Получить свои записи времени",
    description: "Возвращает список всех записей времени текущего пользователя",
  })
  @ApiResponse({
    status: 200,
    description: "Список записей времени пользователя",
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findMyEntries(@GetUser() user: any) {
    return this.timeEntriesService.findAll(user.companyId, user.id);
  }

  @Get("activities")
  @ApiOperation({
    summary: "Получить историю активности",
    description: "Возвращает историю активности (START, STOP, PAUSE, RESUME)",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации (только для админов)",
    type: String,
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Лимит записей (максимум 1000, по умолчанию 100)",
    type: Number,
    example: 100,
  })
  @ApiResponse({ status: 200, description: "История активности" })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  findActivities(
    @GetUser() user: any,
    @Query("userId") userId?: string,
    @Query("limit") limit?: string,
  ) {
    let parsedLimit = 100;
    if (limit) {
      const parsed = parseInt(limit, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        parsedLimit = parsed;
      }
    }

    if (
      user.role !== UserRole.OWNER &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      return this.timeEntriesService.findAllActivities(
        user.companyId,
        user.id,
        parsedLimit,
      );
    }
    return this.timeEntriesService.findAllActivities(
      user.companyId,
      userId,
      parsedLimit,
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Получить запись времени по ID",
    description: "Возвращает информацию о записи времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 200, description: "Информация о записи времени" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  findOne(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.findOne(id, user.companyId);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Обновить запись времени",
    description: "Обновляет информацию о записи времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 200, description: "Запись времени успешно обновлена" })
  @ApiResponse({ status: 400, description: "Неверные данные запроса" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  update(
    @Param("id") id: string,
    @Body() updateTimeEntryDto: UpdateTimeEntryDto,
    @GetUser() user: any,
  ) {
    return this.timeEntriesService.update(
      id,
      updateTimeEntryDto,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Put(":id/stop")
  @ApiOperation({
    summary: "Остановить таймер",
    description:
      "Останавливает активную запись времени и вычисляет финальную длительность",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 200, description: "Таймер успешно остановлен" })
  @ApiResponse({ status: 400, description: "Запись времени уже остановлена" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  stop(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.stop(id, user.companyId, user.id, user.role);
  }

  @Put(":id/pause")
  @ApiOperation({
    summary: "Приостановить таймер",
    description: "Приостанавливает активную запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 200, description: "Таймер успешно приостановлен" })
  @ApiResponse({
    status: 400,
    description: "Запись времени не может быть приостановлена",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  pause(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.pause(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Put(":id/resume")
  @ApiOperation({
    summary: "Возобновить таймер",
    description: "Возобновляет приостановленную запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 200, description: "Таймер успешно возобновлен" })
  @ApiResponse({
    status: 400,
    description: "Запись времени не может быть возобновлена",
  })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  resume(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.resume(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Удалить запись времени",
    description: "Удаляет запись времени",
  })
  @ApiParam({ name: "id", description: "ID записи времени", type: String })
  @ApiResponse({ status: 204, description: "Запись времени успешно удалена" })
  @ApiResponse({ status: 403, description: "Недостаточно прав доступа" })
  @ApiResponse({ status: 404, description: "Запись времени не найдена" })
  remove(@Param("id") id: string, @GetUser() user: any) {
    return this.timeEntriesService.remove(
      id,
      user.companyId,
      user.id,
      user.role,
    );
  }
}
