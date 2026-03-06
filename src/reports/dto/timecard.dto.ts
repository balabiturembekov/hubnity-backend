import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsOptional, IsUUID, IsEnum } from "class-validator";
import { Type } from "class-transformer";

export enum TimecardGroupBy {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
}

export class TimecardFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

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

  @ApiPropertyOptional({ enum: TimecardGroupBy, default: TimecardGroupBy.DAY })
  @IsOptional()
  @IsEnum(TimecardGroupBy)
  groupBy?: TimecardGroupBy;
}

export class TimecardEntryDto {
  @ApiProperty()
  period: string; // "2026-03-05" или "2026-W10" или "2026-03"

  @ApiProperty()
  totalSeconds: number;

  @ApiProperty()
  totalHours: number;

  @ApiProperty()
  billableSeconds: number;

  @ApiProperty()
  billableHours: number;

  @ApiPropertyOptional()
  projectId?: string;

  @ApiPropertyOptional()
  projectName?: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  userName?: string;
}

export class TimecardResponseDto {
  @ApiProperty({ type: [TimecardEntryDto] })
  entries: TimecardEntryDto[];

  @ApiProperty()
  summary: {
    totalSeconds: number;
    totalHours: number;
    billableSeconds: number;
    billableHours: number;
    averagePerDay: number;
  };
}
