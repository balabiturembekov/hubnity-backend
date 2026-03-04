import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

// ==================== ORGANIZATION DTOs ====================

export class CreateOrganizationDto {
  @ApiProperty({ description: "Organization name", example: "Acme Inc." })
  @IsString()
  @IsNotEmpty({ message: "Organization name is required" })
  @MinLength(2, { message: "Organization name must be at least 2 characters" })
  @MaxLength(100, { message: "Organization name cannot exceed 100 characters" })
  name: string;

  @ApiProperty({
    description: "Owner user ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "Owner ID must be a valid UUID" })
  @IsNotEmpty({ message: "Owner ID is required" })
  ownerId: string;

  @ApiPropertyOptional({
    description: "Organization settings",
    example: { theme: "dark" },
  })
  @IsOptional()
  @IsObject({ message: "Settings must be an object" })
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Timezone",
    example: "UTC",
    default: "UTC",
  })
  @IsOptional()
  @IsString({ message: "Timezone must be a string" })
  timezone?: string = "UTC";

  @ApiPropertyOptional({
    description: "Currency",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString({ message: "Currency must be a string" })
  @MinLength(3, { message: "Currency code must be 3 characters" })
  @MaxLength(3, { message: "Currency code must be 3 characters" })
  currency?: string = "USD";
}

export class OrganizationStatsResponseDto {
  @ApiProperty({
    description: "Total members",
    example: {
      total: 10,
      active: 8,
    },

    type: "object",
    properties: {
      total: { type: "number", example: 10 },
      active: { type: "number", example: 8 },
    },
  })
  members: { total: number; active: number };

  @ApiProperty({
    description: "Total projects",
    example: {
      total: { type: "number", example: 5 },
      active: { type: "number", example: 3 },
    },
    type: "object",
    properties: {
      total: { type: "number", example: 5 },
      active: { type: "number", example: 3 },
    },
  })
  projects: { total: number; active: number };

  @ApiProperty({
    description: "Total clients",
    example: 4,
    type: "number",
  })
  clients: number;

  @ApiProperty({
    description: "Total time entries in last 30 days",
    example: {
      last30Days: { type: "number", example: 150 },
    },
    type: "object",
    properties: {
      last30Days: { type: "number", example: 150 },
    },
  })
  timeEntries: { last30Days: number };
}
