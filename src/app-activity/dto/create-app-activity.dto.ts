import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateAppActivityDto {
  @ApiProperty({
    description: "ID записи времени, к которой привязана активность приложения",
    example: "uuid",
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  timeEntryId: string;

  @ApiProperty({
    description:
      "Название приложения (например, 'Visual Studio Code', 'Chrome', 'Slack')",
    example: "Visual Studio Code",
    maxLength: 255,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255, {
    message: "App name cannot exceed 255 characters",
  })
  appName: string;

  @ApiPropertyOptional({
    description: "Заголовок окна приложения (опционально)",
    example: "index.ts - Hubnity",
    maxLength: 500,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: "Window title cannot exceed 500 characters",
  })
  windowTitle?: string;

  @ApiProperty({
    description: "Время использования приложения в секундах",
    example: 3600,
    minimum: 0,
    type: Number,
  })
  @IsInt()
  @Min(0, {
    message: "Time spent cannot be negative",
  })
  timeSpent: number;

  @ApiPropertyOptional({
    description: "Время начала использования приложения (ISO 8601)",
    example: "2024-01-15T10:00:00.000Z",
    type: String,
    format: "date-time",
  })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    description: "Время окончания использования приложения (ISO 8601)",
    example: "2024-01-15T11:00:00.000Z",
    type: String,
    format: "date-time",
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;
}
