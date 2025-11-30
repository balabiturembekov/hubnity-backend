import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TeamActivityService } from './team-activity.service';
import { TeamActivityQueryDto } from './dto/team-activity-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('team-activity')
@Controller('team-activity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class TeamActivityController {
  constructor(private readonly teamActivityService: TeamActivityService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Получить активность команды',
    description: 'Возвращает активность команды с возможностью фильтрации по периоду, пользователю и проекту',
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Активность команды',
    schema: {
      type: 'object',
      properties: {
        activities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid' },
              userId: { type: 'string', example: 'uuid' },
              userName: { type: 'string', example: 'Иван Иванов' },
              userAvatar: { type: 'string', nullable: true },
              projectId: { type: 'string', nullable: true, example: 'uuid' },
              projectName: { type: 'string', nullable: true },
              type: { type: 'string', enum: ['START', 'STOP', 'PAUSE', 'RESUME'], example: 'START' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
        total: { type: 'number', example: 150 },
        period: { type: 'string', example: 'today' },
      },
    },
  })
  async getTeamActivity(@Query() query: TeamActivityQueryDto, @GetUser() user: any) {
    return this.teamActivityService.getTeamActivity(user.companyId, user.id, user.role, query);
  }
}
