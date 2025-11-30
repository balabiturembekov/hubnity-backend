import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@prisma/client';

class UpdateScreenshotSettingsDto {
  @ApiPropertyOptional({
    description: 'Включить/выключить автоматические скриншоты',
    example: true,
    type: Boolean,
  })
  @IsOptional()
  @IsBoolean()
  screenshotEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Интервал съемки скриншотов в секундах (30, 60, 300, 600)',
    example: 60,
    enum: [30, 60, 300, 600],
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  @IsIn([30, 60, 300, 600])
  screenshotInterval?: number;
}

@ApiTags('companies')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('screenshot-settings')
  @ApiOperation({ 
    summary: 'Получить настройки скриншотов компании',
    description: 'Возвращает настройки автоматических скриншотов для компании',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Настройки скриншотов',
    schema: {
      type: 'object',
      properties: {
        screenshotEnabled: { type: 'boolean', example: true },
        screenshotInterval: { type: 'number', example: 60, enum: [30, 60, 300, 600] },
      },
    },
  })
  async getScreenshotSettings(@GetUser() user: any) {
    return this.companiesService.getScreenshotSettings(user.companyId);
  }

  @Patch('screenshot-settings')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Обновить настройки скриншотов компании',
    description: 'Обновляет настройки автоматических скриншотов. Доступно только для OWNER и ADMIN.',
  })
  @ApiBody({ type: UpdateScreenshotSettingsDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Настройки успешно обновлены',
    schema: {
      type: 'object',
      properties: {
        screenshotEnabled: { type: 'boolean', example: true },
        screenshotInterval: { type: 'number', example: 60 },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Неверные данные запроса' })
  @ApiResponse({ status: 403, description: 'Недостаточно прав доступа' })
  async updateScreenshotSettings(@GetUser() user: any, @Body() settings: UpdateScreenshotSettingsDto) {
    return this.companiesService.updateScreenshotSettings(user.companyId, settings);
  }
}
