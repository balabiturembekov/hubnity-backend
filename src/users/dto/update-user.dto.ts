import { PartialType } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import { IsOptional, IsString, MinLength, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({
    description:
      "Новый пароль (минимум 8 символов, максимум 128, должен содержать хотя бы одну букву и одну цифру)",
    example: "newpassword123",
    minLength: 8,
    maxLength: 128,
    format: "password",
  })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  password?: string;
}
