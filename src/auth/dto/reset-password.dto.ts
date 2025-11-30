import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Токен восстановления пароля (из email)',
    example: 'reset-token-here',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Новый пароль (минимум 8 символов, должен содержать буквы и цифры)',
    example: 'newpassword123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword: string;

  @ApiProperty({
    description: 'Подтверждение нового пароля - должно совпадать с новым паролем',
    example: 'newpassword123',
    minLength: 8,
    maxLength: 128,
    format: 'password',
  })
  @IsString()
  @MinLength(8, { message: 'Confirm password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Confirm password must not exceed 128 characters' })
  confirmPassword: string;
}

