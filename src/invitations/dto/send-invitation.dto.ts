import { MemberRole } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsEnum, IsUUID } from "class-validator";

export class SendInvitationDto {
  @ApiProperty({ example: "user@example.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: MemberRole, example: MemberRole.USER })
  @IsEnum(MemberRole)
  role: MemberRole;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  organizationId: string;
}
