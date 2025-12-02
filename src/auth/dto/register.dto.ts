import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsUrl,
  Matches,
} from "class-validator";
import { UserRole } from "@prisma/client";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "Полное имя пользователя (Full name)",
    example: "Иван Иванов",
    minLength: 2,
    maxLength: 255,
    required: true,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: "Email пользователя",
    example: "user@example.com",
    format: "email",
    maxLength: 255,
    required: true,
  })
  @IsEmail()
  @MaxLength(255, { message: "Email must not exceed 255 characters" })
  email: string;

  @ApiProperty({
    description: "Название компании (Company name)",
    example: 'ООО "Пример"',
    minLength: 2,
    maxLength: 255,
    required: true,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  companyName: string;

  @ApiPropertyOptional({
    description: "Домен компании (Company domain) - необязательно",
    example: "example.com",
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: "Company domain must not exceed 255 characters" })
  companyDomain?: string;

  @ApiProperty({
    description:
      "Пароль пользователя (минимум 8 символов, должен содержать буквы и цифры)",
    example: "password123",
    minLength: 8,
    maxLength: 128,
    format: "password",
    required: true,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  password: string;

  @ApiProperty({
    description:
      "Подтверждение пароля (Confirm password) - должно совпадать с паролем",
    example: "password123",
    minLength: 8,
    maxLength: 128,
    format: "password",
    required: true,
  })
  @IsString()
  @MinLength(8, {
    message: "Confirm password must be at least 8 characters long",
  })
  @MaxLength(128, {
    message: "Confirm password must not exceed 128 characters",
  })
  confirmPassword: string;

  @ApiPropertyOptional({
    description: "Роль пользователя",
    enum: UserRole,
    example: UserRole.OWNER,
    default: UserRole.OWNER,
  })
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({
    description: "URL аватара пользователя",
    example: "https://example.com/avatar.jpg",
    format: "url",
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @IsUrl(
    { require_protocol: true, protocols: ["http", "https"] },
    { message: "Avatar must be a valid HTTP/HTTPS URL" },
  )
  @MaxLength(2048, { message: "Avatar URL must not exceed 2048 characters" })
  avatar?: string;

  @ApiPropertyOptional({
    description: "Почасовая ставка (в долларах)",
    example: 25.5,
    minimum: 0,
    maximum: 10000,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000)
  hourlyRate?: number;
}
