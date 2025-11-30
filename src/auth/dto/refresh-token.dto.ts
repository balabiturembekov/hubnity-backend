import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token для получения нового access token',
    example: 'refresh-token-here',
  })
  @IsString()
  refreshToken: string;
}

