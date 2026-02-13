import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AnalyticsPeriod } from "./analytics-query.dto";

export class CompareQueryDto {
  @ApiPropertyOptional({
    description: "Период 1",
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period1?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description: "Начало периода 1 (для custom)",
    example: "2025-01-01",
  })
  @IsOptional()
  @IsDateString()
  startDate1?: string;

  @ApiPropertyOptional({
    description: "Конец периода 1 (для custom)",
    example: "2025-01-31",
  })
  @IsOptional()
  @IsDateString()
  endDate1?: string;

  @ApiPropertyOptional({
    description: "Период 2",
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.LAST_7_DAYS,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period2?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description: "Начало периода 2 (для custom)",
    example: "2025-02-01",
  })
  @IsOptional()
  @IsDateString()
  startDate2?: string;

  @ApiPropertyOptional({
    description: "Конец периода 2 (для custom)",
    example: "2025-02-07",
  })
  @IsOptional()
  @IsDateString()
  endDate2?: string;

  @ApiPropertyOptional({ description: "ID пользователя (общий для обоих периодов)" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: "ID проекта (общий для обоих периодов)" })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
