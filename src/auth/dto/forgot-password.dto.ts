import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email пользователя для восстановления пароля',
    example: 'user@example.com',
    format: 'email',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  email: string;
}

