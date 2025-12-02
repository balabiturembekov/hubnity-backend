import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
} from "class-validator";
import { EntryStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTimeEntryDto {
  @ApiProperty({
    description: "ID пользователя",
    example: "uuid",
    type: String,
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: "ID проекта (обязателен для сотрудников)",
    example: "uuid",
    type: String,
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: "Время начала работы (ISO 8601)",
    example: "2025-11-30T10:00:00Z",
    format: "date-time",
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

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
    default: EntryStatus.RUNNING,
  })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;
}
