import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { TeamActivityService } from "./team-activity.service";
import { TeamActivityQueryDto } from "./dto/team-activity-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { GetUser } from "../auth/decorators/get-user.decorator";

@ApiTags("team-activity")
@Controller("team-activity")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class TeamActivityController {
  constructor(private readonly teamActivityService: TeamActivityService) {}

  @Get()
  @ApiOperation({
    summary: "Получить активность команды",
    description:
      "Возвращает активность команды с возможностью фильтрации по периоду, пользователю и проекту",
  })
  @ApiQuery({
    name: "period",
    required: false,
    description: "Период для фильтрации активности",
    enum: [
      "today",
      "yesterday",
      "7days",
      "30days",
      "90days",
      "this_month",
      "last_month",
      "this_year",
      "custom",
    ],
    example: "30days",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    description: "Начальная дата (используется с period=custom)",
    type: String,
    example: "2025-11-01",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    description: "Конечная дата (используется с period=custom)",
    type: String,
    example: "2025-11-30",
  })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "ID пользователя для фильтрации",
    type: String,
  })
  @ApiQuery({
    name: "projectId",
    required: false,
    description: "ID проекта для фильтрации",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Активность команды",
    schema: {
      type: "object",
      properties: {
        period: {
          type: "object",
          properties: {
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
          },
        },
        totalMembers: { type: "number", example: 10 },
        totalHours: { type: "number", example: 150.5 },
        totalEarned: { type: "number", example: 15000 },
        members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              userId: { type: "string", example: "uuid" },
              userName: { type: "string", example: "Иван Иванов" },
              userEmail: { type: "string", example: "ivan@example.com" },
              userAvatar: { type: "string", nullable: true },
              userRole: { type: "string", example: "EMPLOYEE" },
              hourlyRate: { type: "number", nullable: true },
              totalHours: { type: "number", example: 15.5 },
              totalEarned: { type: "number", example: 1500 },
              activityLevel: {
                type: "string",
                enum: ["low", "medium", "high"],
              },
              projectBreakdown: { type: "array" },
              entriesCount: { type: "number", example: 25 },
              lastActivity: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Не авторизован" })
  @ApiResponse({
    status: 404,
    description: "Пользователь или проект не найден",
  })
  @ApiResponse({ status: 400, description: "Неверные параметры запроса" })
  async getTeamActivity(
    @Query() query: TeamActivityQueryDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    @GetUser() user: any,
  ) {
    return this.teamActivityService.getTeamActivity(
      user.companyId,
      user.id,
      user.role,
      query,
    );
  }
}
