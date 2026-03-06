import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { PayrollService } from "./payroll.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";
import {
  PayrollFilterDto,
  PayrollSummaryDto,
  PayrollRunDto,
  PayrollRunResponseDto,
  PayrollHistoryDto,
} from "./dto/payroll.dto";

@ApiTags("payroll")
@ApiBearerAuth()
@Controller("payroll")
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get("calculate")
  @ApiOperation({ summary: "Calculate payroll for period" })
  @ApiResponse({
    status: 200,
    description: "Payroll calculated",
    type: PayrollSummaryDto,
  })
  async calculatePayroll(
    @GetUser("id") userId: string,
    @Query() filter: PayrollFilterDto,
  ): Promise<PayrollSummaryDto> {
    return this.payrollService.calculatePayroll(userId, filter);
  }

  @Post("run")
  @ApiOperation({ summary: "Run payroll asynchronously" })
  @ApiResponse({
    status: 201,
    description: "Payroll run started",
    type: PayrollRunResponseDto,
  })
  async runPayroll(
    @GetUser("id") userId: string,
    @Body() dto: PayrollRunDto,
  ): Promise<PayrollRunResponseDto> {
    return this.payrollService.runPayroll(userId, dto);
  }

  @Get("runs/:runId")
  @ApiOperation({ summary: "Get payroll run status" })
  @ApiResponse({
    status: 200,
    description: "Payroll run status",
    type: PayrollRunResponseDto,
  })
  async getPayrollStatus(
    @Param("runId") runId: string,
  ): Promise<PayrollRunResponseDto> {
    return this.payrollService.getPayrollStatus(runId);
  }

  @Get("history/:organizationId")
  @ApiOperation({ summary: "Get payroll history" })
  @ApiResponse({
    status: 200,
    description: "Payroll history",
    type: [PayrollHistoryDto],
  })
  async getPayrollHistory(
    @GetUser("id") userId: string,
    @Param("organizationId") organizationId: string,
  ): Promise<PayrollHistoryDto[]> {
    return this.payrollService.getPayrollHistory(userId, organizationId);
  }
}
