import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsUUID, IsOptional } from "class-validator";

export class BudgetFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}

export class ProjectBudgetReportDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectName: string;

  @ApiProperty()
  budgetType: string; // TOTAL, MONTHLY, WEEKLY

  @ApiPropertyOptional()
  hoursLimit?: number;

  @ApiPropertyOptional()
  costLimit?: number;

  @ApiProperty()
  hoursSpent: number;

  @ApiProperty()
  hoursRemaining: number | null;

  @ApiProperty()
  hoursPercentage: number; // 0-100

  @ApiPropertyOptional()
  costSpent?: number;

  @ApiPropertyOptional()
  costRemaining?: number | null;

  @ApiPropertyOptional()
  costPercentage?: number;

  @ApiProperty()
  status: "OK" | "WARNING" | "OVER";

  @ApiProperty()
  timeEntriesCount: number;

  @ApiProperty()
  period: {
    start: Date | null;
    end: Date | null;
  };
}

export class BudgetSummaryDto {
  @ApiProperty({ type: [ProjectBudgetReportDto] })
  projects: ProjectBudgetReportDto[];

  @ApiProperty()
  organizationTotal: {
    projectsCount: number;
    projectsAtRisk: number; // >80% budget used
    projectsOverBudget: number;
    totalHoursSpent: number;
    totalBudgetedHours: number | null;
  };
}
