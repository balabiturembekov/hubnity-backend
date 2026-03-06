import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
  IsEmail,
  IsEnum,
  ArrayMaxSize,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { MemberRole, TeamSize } from "@prisma/client";
import { OrganizationResponseDto } from "./organization-response.dto";

// ==================== ORGANIZATION DTOs ====================

export class InvitedOrganizationUserDto {
  @ApiProperty({ example: "manager@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: MemberRole, example: MemberRole.MANAGER })
  @IsEnum(MemberRole)
  role: MemberRole;
}

/** Options for creating an invite link during organization creation (no organizationId needed). */
export class InviteLinkOptionDto {
  @ApiPropertyOptional({
    description: "Role to assign when joining via link (MANAGER or USER only)",
    enum: MemberRole,
    default: MemberRole.USER,
  })
  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.USER;

  @ApiPropertyOptional({
    description: "Link expiry in days. Omit for no expiry",
    minimum: 1,
    example: 7,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  expiresInDays?: number;

  @ApiPropertyOptional({
    description: "Maximum number of uses. Omit for unlimited",
    minimum: 1,
    example: 10,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxUses?: number;
}

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

  @ApiPropertyOptional({
    description: "Optional invitations sent on organization creation",
    type: [InvitedOrganizationUserDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvitedOrganizationUserDto)
  invitedUsers?: InvitedOrganizationUserDto[];

  @ApiPropertyOptional({
    description:
      "Optional invite links to create with the organization (share link so others can join)",
    type: [InviteLinkOptionDto],
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => InviteLinkOptionDto)
  inviteLinks?: InviteLinkOptionDto[];

  @ApiPropertyOptional({
    description:
      "Optional organization goal IDs to assign to this organization (from the global goals catalog)",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000"],
    maxItems: 50,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  goalIds?: string[];

  @ApiProperty({
    description: "Organization team size",
    enum: TeamSize,
    example: TeamSize.SIZE_3_6,
  })
  @IsEnum(TeamSize)
  teamSize: TeamSize;
}

/** Response when organization is created with optional invite links (when inviteLinks was in the request). */
export class CreateOrganizationWithInviteLinksResponseDto {
  @ApiProperty({ type: OrganizationResponseDto })
  organization: OrganizationResponseDto;

  @ApiProperty({
    description: "Invite links created with the organization",
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        token: { type: "string" },
        role: { enum: ["OWNER", "ADMIN", "MANAGER", "USER"] },
        expiresAt: { type: "string", format: "date-time", nullable: true },
        maxUses: { type: "number", nullable: true },
        useCount: { type: "number" },
        isActive: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  inviteLinks: Array<{
    id: string;
    token: string;
    role: MemberRole;
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
    isActive: boolean;
    createdAt: Date;
  }>;
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
