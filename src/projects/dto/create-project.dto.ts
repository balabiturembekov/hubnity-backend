import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  Matches,
} from "class-validator";
import { ProjectStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateProjectDto {
  @ApiProperty({
    description: "Название проекта",
    example: "Веб-сайт компании",
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Описание проекта",
    example: "Разработка корпоративного веб-сайта",
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({
    description: "Цвет проекта в формате HEX",
    example: "#3b82f6",
    pattern: "^#[0-9A-Fa-f]{6}$",
    default: "#3b82f6",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: "Color must be a valid hex color (e.g., #3b82f6)",
  })
  color?: string;

  @ApiPropertyOptional({
    description: "Название клиента",
    example: 'ООО "Клиент"',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  clientName?: string;

  @ApiPropertyOptional({
    description: "Бюджет проекта (в долларах)",
    example: 10000,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({
    description: "Статус проекта",
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    default: ProjectStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
