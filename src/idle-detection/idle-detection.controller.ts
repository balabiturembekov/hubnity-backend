import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IdleDetectionService } from './idle-detection.service';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { PinoLogger } from 'nestjs-pino';

@ApiTags('idle-detection')
@Controller('idle')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class IdleDetectionController {
  constructor(
    private readonly idleDetectionService: IdleDetectionService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(IdleDetectionController.name);
  }

  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Отправить heartbeat (сигнал активности)',
    description: 'Обновляет время последней активности пользователя. Клиент должен отправлять этот запрос периодически (рекомендуется каждые 30-60 секунд)',
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat успешно обработан',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  @ApiResponse({ status: 404, description: 'Пользователь не найден' })
  async heartbeat(
    @Body() dto: HeartbeatDto,
    @GetUser() user: any,
  ) {
    // Ошибки уже логируются в сервисе, просто пробрасываем их дальше
    return await this.idleDetectionService.handleHeartbeat(
      user.id,
      user.companyId,
      dto,
    );
  }

  @Get('status')
  @ApiOperation({
    summary: 'Получить статус активности пользователя',
    description: 'Возвращает информацию о последнем heartbeat и статусе простоя',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус активности',
    schema: {
      type: 'object',
      properties: {
        isIdle: { type: 'boolean', example: false },
        lastHeartbeat: { type: 'string', format: 'date-time', nullable: true },
        secondsSinceLastHeartbeat: { type: 'number', nullable: true, example: 45 },
        idleThreshold: { type: 'number', example: 300 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Не авторизован' })
  async getStatus(@GetUser() user: any) {
    // Ошибки уже логируются в сервисе, просто пробрасываем их дальше
    return await this.idleDetectionService.getUserActivityStatus(
      user.id,
      user.companyId,
    );
  }
}

