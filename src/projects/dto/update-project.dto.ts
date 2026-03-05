import { ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "@prisma/client";
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

// ==================== UPDATE PROJECT ====================
export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: "Project name",
    example: "Website Redesign v2",
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Project name must be at least 2 characters" })
  @MaxLength(100, { message: "Project name cannot exceed 100 characters" })
  name?: string;

  @ApiPropertyOptional({ description: "Project description" })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: "Status must be a valid ProjectStatus" })
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: "Billable must be a boolean" })
  billable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Hourly rate must be a number" })
  hourlyRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Client ID must be a valid UUID" })
  clientId?: string;
}
