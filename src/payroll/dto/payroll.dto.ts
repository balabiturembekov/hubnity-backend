// payroll/dto/payroll.dto.ts
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsOptional,
  IsDate,
  IsInt,
  Min,
  IsEnum,
  IsString,
  Max,
} from "class-validator";
import { Type } from "class-transformer";

export enum PayrollPeriod {
  WEEKLY = "weekly",
  BI_WEEKLY = "bi_weekly",
  MONTHLY = "monthly",
}

export class PayrollFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: PayrollPeriod })
  @IsOptional()
  @IsEnum(PayrollPeriod)
  period?: PayrollPeriod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2020)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class PayrollItemDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  totalSeconds: number;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  hourlyRate: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  grossPay: number;

  @ApiPropertyOptional()
  bonus?: number;

  @ApiPropertyOptional()
  deductions?: number;

  @ApiProperty()
  netPay: number;

  @ApiProperty()
  timeEntriesCount: number;

  @ApiPropertyOptional({ type: [String] })
  timeEntryIds?: string[];
}

export class PayrollSummaryDto {
  @ApiProperty()
  period: {
    start: Date;
    end: Date;
    name: string;
  };

  @ApiProperty({ type: [PayrollItemDto] })
  items: PayrollItemDto[];

  @ApiProperty()
  totals: {
    totalHours: number;
    totalGross: number;
    totalNet: number;
    employeeCount: number;
  };

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  organizationName: string;

  @ApiProperty()
  generatedAt: Date;
}

export class PayrollRunDto {
  @ApiProperty()
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({ enum: PayrollPeriod })
  @IsOptional()
  @IsEnum(PayrollPeriod)
  period?: PayrollPeriod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2020)
  year?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

export class PayrollRunResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  status: "pending" | "processing" | "completed" | "failed";

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  period: {
    start: Date;
    end: Date;
  };

  @ApiPropertyOptional()
  summary?: PayrollSummaryDto;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  error?: string;
}

export class PayrollHistoryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  runDate: Date;

  @ApiProperty()
  period: string;

  @ApiProperty()
  totalEmployees: number;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  totalGross: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  status: string;
}
