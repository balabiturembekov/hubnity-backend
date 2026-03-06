import { IsString, MinLength, MaxLength, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordDto {
  @ApiProperty({
    description: "Reset password token",
    example: "reset-token-here",
  })
  @IsString()
  token: string;

  @ApiProperty({
    description:
      "New password (must be at least 8 characters long, must contain letters and numbers)",
    example: "newpassword123",
    minLength: 8,
    maxLength: 128,
    format: "password",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      "Password is too weak (must contain at least one letter, one number and one special character)",
  })
  newPassword: string;
}
