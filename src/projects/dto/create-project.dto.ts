import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsNumber,
  IsEnum,
  Max,
  IsDate,
  MinLength,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ProjectStatus, BudgetType, TaskStatus } from "@prisma/client";

// ==================== CREATE PROJECT ====================
export class CreateProjectDto {
  @ApiProperty({ description: "Project name", example: "Website Redesign" })
  @IsString()
  @IsNotEmpty({ message: "Project name is required" })
  @MinLength(2, { message: "Project name must be at least 2 characters" })
  @MaxLength(100, { message: "Project name cannot exceed 100 characters" })
  name: string;

  @ApiPropertyOptional({
    description: "Project description",
    example: "Redesign company website",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: "Status must be a valid ProjectStatus" })
  status?: ProjectStatus;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: "Billable must be a boolean" })
  billable?: boolean;

  @ApiPropertyOptional({ example: 50.0 })
  @IsOptional()
  @IsNumber({}, { message: "Hourly rate must be a number" })
  hourlyRate?: number;

  @ApiProperty({ description: "Organization ID" })
  @IsUUID("4", { message: "Organization ID must be a valid UUID" })
  @IsNotEmpty({ message: "Organization ID is required" })
  organizationId: string;

  @ApiPropertyOptional({ description: "Client ID" })
  @IsOptional()
  @IsUUID("4", { message: "Client ID must be a valid UUID" })
  clientId?: string;
}

// ==================== PROJECT RESPONSE ====================
export class ProjectResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ example: "Website Redesign" })
  name: string;

  @ApiPropertyOptional({ example: "Redesign company website" })
  description: string | null;

  @ApiProperty({ enum: ProjectStatus, example: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @ApiProperty({ example: true })
  billable: boolean;

  @ApiPropertyOptional({ example: 50.0 })
  hourlyRate: number | null;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  clientId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ example: 0 })
  membersCount?: number;

  @ApiPropertyOptional({ example: 0 })
  tasksCount?: number;

  @ApiPropertyOptional({ example: 0 })
  timeEntriesCount?: number;
}

// ==================== PROJECT MEMBER DTOs ====================
export class AddProjectMemberDto {
  @ApiProperty()
  @IsUUID("4", { message: "User ID must be a valid UUID" })
  @IsNotEmpty({ message: "User ID is required" })
  userId: string;

  @ApiPropertyOptional({ default: "MEMBER" })
  @IsOptional()
  @IsString()
  role?: string;
}

export class UpdateProjectMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;
}

export class ProjectMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  joinedAt: Date;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional({
    description: "User",
    type: "object",
    properties: {
      id: { type: "string" },
      firstName: { type: "string" },
      lastName: { type: "string" },
      email: { type: "string" },
      avatar: { type: "string", nullable: true },
    },
  })
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
}

// ==================== PROJECT TASK DTOs ====================
export class CreateProjectTaskDto {
  @ApiProperty({ example: "Design homepage" })
  @IsString()
  @IsNotEmpty({ message: "Task name is required" })
  @MinLength(2, { message: "Task name must be at least 2 characters" })
  @MaxLength(200, { message: "Task name cannot exceed 200 characters" })
  name: string;

  @ApiPropertyOptional({ example: "Create wireframes and mockups" })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Description cannot exceed 1000 characters" })
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.OPEN })
  @IsOptional()
  @IsEnum(TaskStatus, { message: "Status must be a valid TaskStatus" })
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Assignee ID must be a valid UUID" })
  assigneeId?: string;
}

export class UpdateProjectTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Task name must be at least 2 characters" })
  @MaxLength(200, { message: "Task name cannot exceed 200 characters" })
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Description cannot exceed 1000 characters" })
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus, { message: "Status must be a valid TaskStatus" })
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Assignee ID must be a valid UUID" })
  assigneeId?: string;
}

export class ProjectTaskResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiPropertyOptional()
  dueDate: Date | null;

  @ApiProperty()
  projectId: string;

  @ApiPropertyOptional()
  assigneeId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };
}

// ==================== PROJECT BUDGET DTOs ====================
export class CreateProjectBudgetDto {
  @ApiProperty({ enum: BudgetType })
  @IsEnum(BudgetType, { message: "Budget type must be a valid BudgetType" })
  @IsNotEmpty({ message: "Budget type is required" })
  budgetType: BudgetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Hours limit must be a number" })
  hoursLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Cost limit must be a number" })
  @MinLength(0, { message: "Cost limit cannot be negative" })
  @MaxLength(10000, { message: "Cost limit cannot exceed 10000" })
  costLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({ default: 80 })
  @IsOptional()
  @IsNumber({}, { message: "Notification threshold must be a number" })
  @MinLength(0, { message: "Notification threshold cannot be negative" })
  @MaxLength(100, { message: "Notification threshold cannot exceed 100" })
  @Max(100, { message: "Notification threshold cannot exceed 100" })
  notificationThreshold?: number;
}

export class UpdateProjectBudgetDto {
  @ApiPropertyOptional({ enum: BudgetType })
  @IsOptional()
  @IsEnum(BudgetType, { message: "Budget type must be a valid BudgetType" })
  budgetType?: BudgetType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Hours limit must be a number" })
  hoursLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Cost limit must be a number" })
  @MinLength(0, { message: "Cost limit cannot be negative" })
  @MaxLength(10000, { message: "Cost limit cannot exceed 10000" })
  costLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({}, { message: "Notification threshold must be a number" })
  @MinLength(0, { message: "Notification threshold cannot be negative" })
  @MaxLength(100, { message: "Notification threshold cannot exceed 100" })
  notificationThreshold?: number;
}

export class ProjectBudgetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: BudgetType })
  budgetType: BudgetType;

  @ApiPropertyOptional()
  hoursLimit: number | null;

  @ApiPropertyOptional()
  costLimit: number | null;

  @ApiPropertyOptional()
  startDate: Date | null;

  @ApiPropertyOptional()
  endDate: Date | null;

  @ApiProperty()
  notificationThreshold: number;

  @ApiProperty()
  projectId: string;
}

// ==================== FILTER DTOs ====================
export class ProjectFilterDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: "Status must be a valid ProjectStatus" })
  status?: ProjectStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Client ID must be a valid UUID" })
  clientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean({ message: "Billable must be a boolean" })
  billable?: boolean;
}

export class TaskFilterDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus, { message: "Status must be a valid TaskStatus" })
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { message: "Assignee ID must be a valid UUID" })
  assigneeId?: string;
}
