import { IsEmail, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Email пользователя для восстановления пароля",
    example: "user@example.com",
  })
  @IsEmail()
  @Transform(({ value }) => value?.toLowerCase().trim())
  @MaxLength(255, { message: "Email must not exceed 255 characters" })
  email: string;
}
