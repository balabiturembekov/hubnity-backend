import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MemberRole } from "@prisma/client";

export class InviteLink {}

export class InviteLinkEntity {
  @ApiProperty({ example: "uuid", description: "Invite link ID" })
  id: string;

  @ApiProperty({ description: "Unique token for the invite link" })
  token: string;

  @ApiProperty({ enum: MemberRole, description: "Role assigned when joining" })
  role: MemberRole;

  @ApiProperty({ description: "Organization ID" })
  organizationId: string;

  @ApiPropertyOptional({
    description: "Expiry date (null = never)",
    nullable: true,
  })
  expiresAt?: Date | null;

  @ApiPropertyOptional({
    description: "Max uses (null = unlimited)",
    nullable: true,
  })
  maxUses?: number | null;

  @ApiProperty({ description: "Current use count" })
  useCount: number;

  @ApiProperty({ description: "Whether the link is active" })
  isActive: boolean;

  @ApiProperty({ description: "Creation date" })
  createdAt: Date;
}
