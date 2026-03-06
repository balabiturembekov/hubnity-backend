import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from "class-validator";
import { MemberRole } from "@prisma/client";

export class CreateInviteLinkDto {
  @ApiProperty({
    description: "Organization ID to invite users to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  organizationId: string;

  @ApiPropertyOptional({
    description: "Role to assign when joining via link (MANAGER or USER only)",
    enum: MemberRole,
    default: MemberRole.USER,
  })
  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole = MemberRole.USER;

  @ApiPropertyOptional({
    description: "Link expiry in days (e.g. 7 for a week). Omit for no expiry",
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
