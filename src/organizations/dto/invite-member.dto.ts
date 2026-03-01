import { IsEmail, IsEnum, IsNotEmpty, IsUUID } from "class-validator";
import { OrganizationRole } from "@prisma/client";

export class InviteMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(OrganizationRole)
  @IsNotEmpty()
  role: OrganizationRole;

  @IsUUID()
  @IsNotEmpty()
  organizationId: string;
}
