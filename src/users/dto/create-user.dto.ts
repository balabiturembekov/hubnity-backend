import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from "class-validator";
import { UserRole, UserStatus } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({
    description: "Имя пользователя",
    example: "Иван Иванов",
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
    format: "email",
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      "Пароль пользователя (минимум 8 символов, максимум 128, должен содержать хотя бы одну букву и одну цифру)",
    example: "password123",
    minLength: 8,
    maxLength: 128,
    format: "password",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  password: string;

  @ApiPropertyOptional({
    description: "Роль пользователя",
    enum: UserRole,
    example: UserRole.EMPLOYEE,
    default: UserRole.EMPLOYEE,
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: "Статус пользователя",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    default: UserStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: "URL аватара пользователя",
    example: "https://example.com/avatar.jpg",
    type: String,
  })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiPropertyOptional({
    description: "Почасовая ставка (в долларах, максимум $10,000)",
    example: 25.5,
    minimum: 0,
    maximum: 10000,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000, { message: "Hourly rate cannot exceed $10,000 per hour" })
  hourlyRate?: number;
}
