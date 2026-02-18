import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { EntryStatus } from "@prisma/client";

export class SyncTimeEntryItemDto {
  @ApiProperty({
    description: "Client-generated UUID for idempotency (deduplication on retry)",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @IsString()
  @IsUUID("4")
  idempotencyKey: string;

  @ApiProperty({
    description: "ID пользователя",
    example: "uuid",
  })
  @IsString()
  userId: string;

  @ApiPropertyOptional({
    description: "ID проекта (обязателен для сотрудников)",
    example: "uuid",
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiProperty({
    description: "Время начала работы (ISO 8601)",
    example: "2025-11-30T10:00:00Z",
  })
  @IsDateString()
  startTime: string;

  @ApiPropertyOptional({
    description: "Время окончания (ISO 8601)",
    example: "2025-11-30T12:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: "Длительность в секундах",
    example: 7200,
  })
  @IsOptional()
  duration?: number;

  @ApiPropertyOptional({
    description: "Описание выполненной работы",
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: "Статус записи",
    enum: EntryStatus,
    default: EntryStatus.STOPPED,
  })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({
    description: "IANA timezone (e.g. Europe/Moscow)",
    example: "Europe/Moscow",
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;
}

export class SyncTimeEntriesDto {
  @ApiProperty({
    description: "Array of time entries to sync (max 100)",
    type: [SyncTimeEntryItemDto],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "At least one entry required" })
  @ArrayMaxSize(100, { message: "Maximum 100 entries per request" })
  @ValidateNested({ each: true })
  @Type(() => SyncTimeEntryItemDto)
  entries: SyncTimeEntryItemDto[];
}
