// ==================== ORGANIZATION MEMBER DTOs ====================

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRole, MemberStatus } from "@prisma/client";
import {
  IsUUID,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
  Max,
  Min,
} from "class-validator";

export class AddOrganizationMemberDto {
  @ApiProperty({
    description: "User ID to add",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "User ID must be a valid UUID" })
  @IsNotEmpty({ message: "User ID is required" })
  userId: string;

  @ApiPropertyOptional({
    enum: MemberRole,
    example: MemberRole.USER,
    default: MemberRole.USER,
  })
  @IsOptional()
  @IsEnum(MemberRole, { message: "Role must be a valid MemberRole" })
  role?: MemberRole;

  @ApiPropertyOptional({
    enum: MemberStatus,
    example: MemberStatus.PENDING,
    default: MemberStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(MemberStatus, { message: "Status must be a valid MemberStatus" })
  status?: MemberStatus;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @IsNumber({}, { message: "Hourly rate must be a number" })
  @Min(0, { message: "Hourly rate cannot be negative" })
  hourlyRate?: number;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsNumber({}, { message: "Weekly limit must be a number" })
  @Min(0, { message: "Weekly limit cannot be negative" })
  @Max(168, { message: "Weekly limit cannot exceed 168 hours" })
  weeklyLimit?: number;

  @ApiPropertyOptional({ example: { notifications: true } })
  @IsOptional()
  @IsObject({ message: "Settings must be an object" })
  settings?: Record<string, any>;

  @ApiPropertyOptional({
    description: "ID of user who invited",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID("4", { message: "Invited by ID must be a valid UUID" })
  invitedById?: string;
}

export class UpdateOrganizationMemberDto {
  @ApiPropertyOptional({ enum: MemberRole, example: MemberRole.ADMIN })
  @IsOptional()
  @IsEnum(MemberRole, { message: "Role must be a valid MemberRole" })
  role?: MemberRole;

  @ApiPropertyOptional({ enum: MemberStatus, example: MemberStatus.ACTIVE })
  @IsOptional()
  @IsEnum(MemberStatus, { message: "Status must be a valid MemberStatus" })
  status?: MemberStatus;

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @IsNumber({}, { message: "Hourly rate must be a number" })
  @Min(0, { message: "Hourly rate cannot be negative" })
  hourlyRate?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber({}, { message: "Weekly limit must be a number" })
  @Min(0, { message: "Weekly limit cannot be negative" })
  @Max(168, { message: "Weekly limit cannot exceed 168 hours" })
  weeklyLimit?: number;

  @ApiPropertyOptional({ example: { notifications: false } })
  @IsOptional()
  @IsObject({ message: "Settings must be an object" })
  settings?: Record<string, any>;
}

export class OrganizationMemberResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ enum: MemberRole, example: MemberRole.USER })
  role: MemberRole;

  @ApiProperty({ enum: MemberStatus, example: MemberStatus.ACTIVE })
  status: MemberStatus;

  @ApiPropertyOptional({ example: 25.5 })
  hourlyRate: number | null;

  @ApiPropertyOptional({ example: 40 })
  weeklyLimit: number | null;

  @ApiPropertyOptional({ example: "2024-01-01T00:00:00.000Z" })
  joinedAt: Date | null;

  @ApiPropertyOptional({ example: "2024-01-01T00:00:00.000Z" })
  invitedAt: Date | null;

  @ApiPropertyOptional({ example: { notifications: true } })
  settings: Record<string, any> | null;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  organizationId: string;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  userId: string;

  @ApiPropertyOptional({ example: "123e4567-e89b-12d3-a456-426614174000" })
  invitedById: string | null;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiPropertyOptional({
    description: "User",
    type: "object",
    properties: {
      id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
      firstName: { type: "string", example: "John" },
      lastName: { type: "string", example: "Doe" },
      email: { type: "string", example: "john@example.com" },
      avatar: { type: "string", example: "avatar.jpg", nullable: true },
    },
  })
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar: string | null;
  };

  @ApiPropertyOptional({
    description: "Invited by",
    type: "object",
    properties: {
      id: { type: "string", example: "123e4567-e89b-12d3-a456-426614174000" },
      firstName: { type: "string", example: "Jane" },
      lastName: { type: "string", example: "Smith" },
      email: { type: "string", example: "jane@example.com" },
    },
  })
  invitedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export class MemberFilterDto {
  @ApiPropertyOptional({ enum: MemberRole, example: MemberRole.ADMIN })
  @IsOptional()
  @IsEnum(MemberRole, { message: "Role must be a valid MemberRole" })
  role?: MemberRole;

  @ApiPropertyOptional({ enum: MemberStatus, example: MemberStatus.ACTIVE })
  @IsOptional()
  @IsEnum(MemberStatus, { message: "Status must be a valid MemberStatus" })
  status?: MemberStatus;
}
