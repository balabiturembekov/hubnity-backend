import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export enum AnalyticsPeriod {
  TODAY = "today",
  YESTERDAY = "yesterday",
  LAST_7_DAYS = "7days",
  LAST_30_DAYS = "30days",
  LAST_90_DAYS = "90days",
  THIS_MONTH = "this_month",
  LAST_MONTH = "last_month",
  THIS_YEAR = "this_year",
  CUSTOM = "custom",
}

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: "Период для аналитики",
    enum: AnalyticsPeriod,
    example: AnalyticsPeriod.LAST_30_DAYS,
  })
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    description: "Начальная дата (используется с period=custom)",
    example: "2025-01-01",
    format: "date",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Конечная дата (используется с period=custom)",
    example: "2025-01-31",
    format: "date",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "ID пользователя для фильтрации",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({
    description: "ID проекта для фильтрации",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: "Лимит записей (для work-sessions, apps-urls)",
    type: Number,
    minimum: 1,
    maximum: 500,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
