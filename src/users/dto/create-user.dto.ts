import {
  IsString,
  IsEmail,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
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
    description: "Пароль пользователя (минимум 8 символов)",
    example: "password123",
    minLength: 8,
    format: "password",
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
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
    description: "Почасовая ставка (в долларах)",
    example: 25.5,
    minimum: 0,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyRate?: number;
}
