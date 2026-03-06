import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsDate,
} from "class-validator";
import { Type } from "class-transformer";

export class StartTimeEntryDto {
  @ApiProperty({ description: "Project ID" })
  @IsUUID("4", { message: "Project ID must be a valid UUID" })
  @IsNotEmpty({ message: "Project ID is required" })
  projectId: string;

  @ApiPropertyOptional({ description: "Task ID" })
  @IsOptional()
  @IsUUID("4", { message: "Task ID must be a valid UUID" })
  taskId?: string;

  @ApiPropertyOptional({ description: "Description of work" })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}

export class StopTimeEntryDto {
  @ApiPropertyOptional({ description: "Description of work" })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ManualTimeEntryDto {
  @ApiProperty()
  @IsUUID("4", { message: "Project ID must be a valid UUID" })
  @IsNotEmpty({ message: "Project ID is required" })
  projectId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Task ID must be a valid UUID" })
  taskId?: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  endTime: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;
}

export class UpdateTimeEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startTime?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Task ID must be a valid UUID" })
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class TimeEntryFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4")
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  fromDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  toDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approved?: boolean;
}

export class TimeEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startTime: Date;

  @ApiPropertyOptional()
  endTime: Date | null;

  @ApiPropertyOptional()
  duration: number | null;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty()
  billable: boolean;

  @ApiProperty()
  approved: boolean;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  taskId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };

  @ApiPropertyOptional()
  project?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  task?: {
    id: string;
    name: string;
  };
}
