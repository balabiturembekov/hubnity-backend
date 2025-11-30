import { IsOptional, IsEnum, IsDateString, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ActivityPeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  LAST_7_DAYS = '7days',
  LAST_30_DAYS = '30days',
  LAST_90_DAYS = '90days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom',
}

export class TeamActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Период для фильтрации активности',
    enum: ActivityPeriod,
    example: ActivityPeriod.TODAY,
  })
  @IsOptional()
  @IsEnum(ActivityPeriod)
  period?: ActivityPeriod;

  @ApiPropertyOptional({
    description: 'Начальная дата (используется с period=custom)',
    example: '2025-11-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Конечная дата (используется с period=custom)',
    example: '2025-11-30',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'ID пользователя для фильтрации',
    example: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'ID проекта для фильтрации',
    example: 'uuid',
    type: String,
  })
  @IsOptional()
  @IsString()
  projectId?: string;
}

