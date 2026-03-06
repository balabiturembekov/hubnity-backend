// import { GetUser } from "@/auth/decorators/get-user.decorator";
// import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard";
// import {
//   Controller,
//   ForbiddenException,
//   Get,
//   Query,
//   UseGuards,
// } from "@nestjs/common";
// import { ApiOperation, ApiTags } from "@nestjs/swagger";
// import { DashboardService } from "./dashboard.service";
// import { PrismaService } from "@/prisma/prisma.service";

// @ApiTags("dashboard")
// @Controller("dashboard")
// @UseGuards(JwtAuthGuard)
// export class DashboardController {
//   constructor(
//     private dashboardService: DashboardService,
//     private prisma: PrismaService,
//   ) {}

//   @Get("daily")
//   @ApiOperation({ summary: "Статистика за день" })
//   async getDaily(
//     @GetUser("id") userId: string,
//     @Query("organizationId") organizationId: string,
//     @Query("date") date?: string,
//   ) {
//     const targetDate = date ? new Date(date) : new Date();
//     return this.dashboardService.getDailyStats(
//       userId,
//       organizationId,
//       targetDate,
//     );
//   }

//   @Get("team")
//   @ApiOperation({ summary: "Статистика всей команды (для админов)" })
//   @UseGuards(JwtAuthGuard)
//   async getTeamStats(
//     @GetUser("id") userId: string,
//     @Query("organizationId") organizationId: string,
//   ) {
//     // 1. Сначала проверяем, есть ли у юзера права (только OWNER или MANAGER)
//     // В Hubstaff обычные сотрудники не видят чужую статистику
//     const member = await this.prisma.organizationMember.findUnique({
//       where: {
//         userId_organizationId: { userId, organizationId },
//       },
//     });

//     if (!member || !["OWNER", "MANAGER"].includes(member.role)) {
//       throw new ForbiddenException(
//         "У вас нет прав на просмотр статистики команды",
//       );
//     }

//     // 2. Если права есть — отдаем данные из сервиса
//     return this.dashboardService.getAdminTeamStats(organizationId);
//   }
// }
