// time-entries/approval.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Ip,
  Headers,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ApprovalService } from "./approval.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import {
  ApproveTimeEntryDto,
  LockPeriodDto,
  TimeEditLogDto,
} from "./dto/approval.dto";

@ApiTags("time-entries/approval")
@ApiBearerAuth()
@Controller("time-entries")
@UseGuards(JwtAuthGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post("approve")
  @ApiOperation({ summary: "Approve multiple time entries" })
  @ApiResponse({ status: 200, description: "Time entries approved" })
  async approveTimeEntries(
    @GetUser("id") userId: string,
    @Body() dto: ApproveTimeEntryDto,
    @Ip() ip: string,
    @Headers("user-agent") userAgent: string,
  ) {
    return this.approvalService.approveTimeEntries(userId, dto, ip, userAgent);
  }

  @Post("organizations/:orgId/lock-period")
  @ApiOperation({ summary: "Lock a period for editing" })
  async lockPeriod(
    @Param("orgId", ParseUUIDPipe) organizationId: string,
    @GetUser("id") userId: string,
    @Body() dto: LockPeriodDto,
  ) {
    return this.approvalService.lockPeriod(organizationId, userId, dto);
  }

  @Post("periods/:periodId/unlock")
  @ApiOperation({ summary: "Unlock a previously locked period" })
  async unlockPeriod(
    @Param("periodId", ParseUUIDPipe) periodId: string,
    @GetUser("id") userId: string,
    @Body("reason") reason?: string,
  ) {
    return this.approvalService.unlockPeriod(periodId, userId, reason);
  }

  @Get(":timeEntryId/logs")
  @ApiOperation({ summary: "Get edit history for a time entry" })
  @ApiResponse({ type: [TimeEditLogDto] })
  async getTimeEntryLogs(
    @Param("timeEntryId", ParseUUIDPipe) timeEntryId: string,
    @GetUser("id") userId: string,
  ): Promise<TimeEditLogDto[]> {
    return this.approvalService.getTimeEntryLogs(timeEntryId, userId);
  }
}
