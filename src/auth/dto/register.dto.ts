import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from "class-validator";
export class RegisterDto {
  @ApiPropertyOptional({
    description: "Имя пользователя",
    example: "Иван",
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  firstName: string;

  @ApiPropertyOptional({
    description: "Фамилия пользователя",
    example: "Иванов",
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  lastName: string;

  @ApiPropertyOptional({
    description: "Email пользователя",
    example: "ivan@example.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: "Пароль пользователя",
    example: "password123",
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @IsNotEmpty()
  password: string;
}
