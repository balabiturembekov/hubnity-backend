import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { TimeEntriesService } from "./time-entries.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import {
  StartTimeEntryDto,
  StopTimeEntryDto,
  ManualTimeEntryDto,
  UpdateTimeEntryDto,
  TimeEntryFilterDto,
  TimeEntryResponseDto,
} from "./dto/create-time-entry.dto";
import {
  AppActivityDto,
  AppActivityResponseDto,
  AppActivityFilterDto,
} from "./dto/app-activity.dto";
import { IdlePeriodDto, IdlePeriodResponseDto } from "./dto/idle.dto";

@ApiTags("time-entries")
@ApiBearerAuth()
@Controller("time-entries")
@UseGuards(JwtAuthGuard)
export class TimeEntriesController {
  constructor(private readonly timeEntriesService: TimeEntriesService) {}

  // ==================== ТАЙМЕРЫ ====================

  @Post("start")
  @ApiOperation({ summary: "Start timer" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Timer started successfully",
    schema: {
      properties: {
        message: { type: "string", example: "Timer started successfully" },
        timerId: { type: "string", example: "timer_1234567890_user123" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Already have active timer",
  })
  @HttpCode(HttpStatus.CREATED)
  async startTimer(
    @GetUser("id") userId: string,
    @Body() dto: StartTimeEntryDto,
  ) {
    return this.timeEntriesService.startTimer(userId, dto);
  }

  @Post("stop")
  @ApiOperation({ summary: "Stop timer and create time entry" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Timer stopped, time entry created",
    type: TimeEntryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "No active timer found",
  })
  @HttpCode(HttpStatus.CREATED)
  async stopTimer(
    @GetUser("id") userId: string,
    @Body() dto: StopTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.stopTimer(userId, dto);
  }

  @Get("active")
  @ApiOperation({ summary: "Get active timer status" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Active timer status",
    schema: {
      properties: {
        isActive: { type: "boolean" },
        startTime: { type: "string", format: "date-time" },
        data: {
          type: "object",
          properties: {
            projectId: { type: "string" },
            taskId: { type: "string" },
            description: { type: "string" },
            billable: { type: "boolean" },
          },
        },
      },
    },
  })
  async getActiveTimer(@GetUser("id") userId: string) {
    return this.timeEntriesService.getActiveTimer(userId);
  }

  // ==================== MANUAL ENTRIES ====================

  @Post("manual")
  @ApiOperation({ summary: "Create manual time entry" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Time entry created",
    type: TimeEntryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid time range",
  })
  @HttpCode(HttpStatus.CREATED)
  async createManualEntry(
    @GetUser("id") userId: string,
    @Body() dto: ManualTimeEntryDto,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.createManualEntry(userId, dto);
  }

  // ==================== CRUD TIME ENTRIES ====================

  @Get()
  @ApiOperation({ summary: "Get all time entries" })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "userId", required: false })
  @ApiQuery({ name: "fromDate", required: false })
  @ApiQuery({ name: "toDate", required: false })
  @ApiQuery({ name: "billable", required: false, type: "boolean" })
  @ApiQuery({ name: "approved", required: false, type: "boolean" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "List of time entries",
    type: [TimeEntryResponseDto],
  })
  async getTimeEntries(
    @GetUser("id") userId: string,
    @Query() filters: TimeEntryFilterDto,
  ): Promise<TimeEntryResponseDto[]> {
    return this.timeEntriesService.getTimeEntries(userId, filters);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get time entry by ID" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Time entry details",
    type: TimeEntryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Time entry not found",
  })
  async getTimeEntryById(
    @Param("id", ParseUUIDPipe) id: string,
    @GetUser("id") userId: string,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.getTimeEntryById(id, userId);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update time entry" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Time entry updated",
    type: TimeEntryResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Time entry not found",
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: "Invalid data" })
  async updateTimeEntry(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeEntryDto,
    @GetUser("id") userId: string,
  ): Promise<TimeEntryResponseDto> {
    return this.timeEntriesService.updateTimeEntry(id, dto, userId);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete time entry" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Time entry deleted",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Time entry not found",
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTimeEntry(
    @Param("id", ParseUUIDPipe) id: string,
    @GetUser("id") userId: string,
  ): Promise<void> {
    await this.timeEntriesService.deleteTimeEntry(id, userId);
  }

  @Post(":timeEntryId/idle")
  @ApiOperation({ summary: "Record idle period" })
  async recordIdlePeriod(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
    @Body() dto: IdlePeriodDto,
  ): Promise<IdlePeriodResponseDto> {
    return this.timeEntriesService.recordIdlePeriod(timeEntryId, userId, dto);
  }

  @Get(":timeEntryId/idle")
  @ApiOperation({ summary: "Get idle periods" })
  async getIdlePeriods(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
  ): Promise<IdlePeriodResponseDto[]> {
    return this.timeEntriesService.getIdlePeriods(timeEntryId, userId);
  }

  @Post(":timeEntryId/app-activities")
  @ApiOperation({ summary: "Record app activity" })
  async recordAppActivity(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
    @Body() dto: AppActivityDto,
  ): Promise<AppActivityResponseDto> {
    return this.timeEntriesService.recordAppActivity(timeEntryId, userId, dto);
  }

  @Get(":timeEntryId/app-activities")
  @ApiOperation({ summary: "Get app activities" })
  async getAppActivities(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
    @Query() filter: AppActivityFilterDto,
  ): Promise<AppActivityResponseDto[]> {
    return this.timeEntriesService.getAppActivities(
      timeEntryId,
      userId,
      filter,
    );
  }

  @Get(":timeEntryId/app-stats")
  @ApiOperation({ summary: "Get app usage statistics" })
  async getAppStats(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
  ): Promise<any> {
    return this.timeEntriesService.getAppStats(timeEntryId, userId);
  }

  @Post("check-idle")
  @ApiOperation({ summary: "Check if user is idle" })
  async checkIdle(
    @GetUser("id") userId: string,
    @Body("lastActivityTimestamp") lastActivityTimestamp: Date,
  ): Promise<{ isIdle: boolean; idleDuration?: number }> {
    return this.timeEntriesService.checkIdle(
      userId,
      new Date(lastActivityTimestamp),
    );
  }
}
