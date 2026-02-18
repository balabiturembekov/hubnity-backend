import { IsEmail, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

export class CreateInvitationDto {
  @ApiProperty({
    description: "Email address to invite",
    example: "newuser@example.com",
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: "Role to assign to the invited user",
    enum: [UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.ADMIN],
    default: UserRole.EMPLOYEE,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
