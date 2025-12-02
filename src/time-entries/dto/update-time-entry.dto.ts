import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
  MaxLength,
} from "class-validator";
import { EntryStatus } from "@prisma/client";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateTimeEntryDto {
  @ApiPropertyOptional({
    description: "ID проекта",
    example: "uuid",
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  projectId?: string | null;

  @ApiPropertyOptional({
    description: "Время начала работы (ISO 8601)",
    example: "2025-11-30T10:00:00Z",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: "Время окончания работы (ISO 8601)",
    example: "2025-11-30T18:00:00Z",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: "Длительность в секундах",
    example: 28800,
    minimum: 0,
    maximum: 2147483647,
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  duration?: number;

  @ApiPropertyOptional({
    description: "Описание выполненной работы",
    example: "Разработка функционала авторизации",
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: "Статус записи времени",
    enum: EntryStatus,
    example: EntryStatus.RUNNING,
  })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;
}
