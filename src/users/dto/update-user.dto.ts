import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "Имя пользователя",
    example: "Иван",
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Имя пользователя должно быть не менее 2 символов" })
  @MaxLength(255, {
    message: "Имя пользователя не должно превышать 255 символов",
  })
  firstName: string;

  @ApiPropertyOptional({
    description: "Фамилия пользователя",
    example: "Иванов",
  })
  @IsOptional()
  @IsString()
  @MinLength(2, {
    message: "Фамилия пользователя должно быть не менее 2 символов",
  })
  @MaxLength(255, {
    message: "Фамилия пользователя не должно превышать 255 символов",
  })
  lastName: string;

  @ApiPropertyOptional({
    description: "Email пользователя",
    example: "ivan@example.com",
  })
  @IsOptional()
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: "Аватар пользователя",
    example: "avatar.jpg",
  })
  @IsOptional()
  @IsString()
  avatar: string;
}
