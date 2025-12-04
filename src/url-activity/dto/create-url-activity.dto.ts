import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUrlActivityDto {
  @ApiProperty({
    description: "ID записи времени, к которой привязана активность URL",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    type: String,
  })
  @IsUUID()
  @IsNotEmpty()
  timeEntryId: string;

  @ApiProperty({
    description: "Полный URL страницы",
    example: "https://github.com/user/repo",
    maxLength: 2048,
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048, {
    message: "URL cannot exceed 2048 characters",
  })
  @Matches(/^https?:\/\/.+/, {
    message: "URL must start with http:// or https://",
  })
  url: string;

  @ApiPropertyOptional({
    description: "Домен URL (извлекается автоматически из URL, если не указан)",
    example: "github.com",
    maxLength: 255,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255, {
    message: "Domain cannot exceed 255 characters",
  })
  domain?: string;

  @ApiPropertyOptional({
    description: "Заголовок страницы (title)",
    example: "GitHub Repository",
    maxLength: 500,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: "Title cannot exceed 500 characters",
  })
  title?: string;

  @ApiProperty({
    description: "Время использования URL в секундах",
    example: 1800,
    minimum: 0,
    type: Number,
  })
  @IsInt()
  @Min(0, {
    message: "Time spent cannot be negative",
  })
  timeSpent: number;

  @ApiPropertyOptional({
    description: "Время начала использования URL (ISO 8601)",
    example: "2024-01-15T10:00:00.000Z",
    type: String,
    format: "date-time",
  })
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({
    description: "Время окончания использования URL (ISO 8601)",
    example: "2024-01-15T10:30:00.000Z",
    type: String,
    format: "date-time",
  })
  @IsDateString()
  @IsOptional()
  endTime?: string;
}
