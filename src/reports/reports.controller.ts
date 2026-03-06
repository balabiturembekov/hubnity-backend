// reports/reports.controller.ts
import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { TimecardFilterDto, TimecardResponseDto } from "./dto/timecard.dto";
import { BudgetFilterDto, BudgetSummaryDto } from "./dto/budget.dto";

@ApiTags("reports")
@ApiBearerAuth()
@Controller("reports")
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("timecards")
  @ApiOperation({ summary: "Get timecards aggregated by day/week/month" })
  @ApiResponse({
    status: 200,
    description: "Timecards generated successfully",
    type: TimecardResponseDto,
  })
  async getTimecards(
    @GetUser("id") userId: string,
    @Query() filter: TimecardFilterDto,
  ): Promise<TimecardResponseDto> {
    return this.reportsService.getTimecards(userId, filter);
  }

  @Get("budgets")
  @ApiOperation({ summary: "Get project budget reports" })
  @ApiResponse({
    status: 200,
    description: "Budget reports generated successfully",
    type: BudgetSummaryDto,
  })
  async getProjectBudgets(
    @GetUser("id") userId: string,
    @Query() filter: BudgetFilterDto,
  ): Promise<BudgetSummaryDto> {
    return this.reportsService.getProjectBudgets(userId, filter);
  }
}
