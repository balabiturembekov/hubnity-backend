import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsUrl,
  IsEnum,
  IsDate,
} from "class-validator";

export enum AppCategory {
  PRODUCTIVE = "productive",
  UNPRODUCTIVE = "unproductive",
  NEUTRAL = "neutral",
  DEVELOPMENT = "development",
  COMMUNICATION = "communication",
  DESIGN = "design",
}

export class AppActivityDto {
  @ApiProperty({ example: "Visual Studio Code" })
  @IsString()
  appName: string;

  @ApiPropertyOptional({ example: "index.ts - hubnity-backend" })
  @IsOptional()
  @IsString()
  windowTitle?: string;

  @ApiPropertyOptional({ example: "https://github.com/balabi/hubnity" })
  @IsOptional()
  @IsUrl()
  url?: string;

  @ApiPropertyOptional({ example: "github.com" })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: AppCategory })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;

  @ApiProperty({ example: 120 })
  @IsInt()
  @Min(1)
  durationSeconds: number;

  @ApiProperty()
  @IsDate()
  trackedAt: Date;
}

export class AppActivityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  appName: string;

  @ApiPropertyOptional()
  windowTitle: string | null;

  @ApiPropertyOptional()
  url: string | null;

  @ApiPropertyOptional()
  domain: string | null;

  @ApiPropertyOptional()
  category: string | null;

  @ApiProperty()
  durationSeconds: number;

  @ApiProperty()
  trackedAt: Date;

  @ApiProperty()
  timeEntryId: string;
}

export class AppActivityFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: AppCategory })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  limit?: number = 100;
}
