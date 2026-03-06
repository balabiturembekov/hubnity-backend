// import { Injectable } from "@nestjs/common";
// import { PrismaService } from "../prisma/prisma.service";

// @Injectable()
// export class DashboardService {
//   constructor(private prisma: PrismaService) {}

//   async getDailyStats(
//     userId: string,
//     organizationId: string,
//     date: Date = new Date(),
//   ) {
//     const start = new Date(date);
//     start.setUTCHours(0, 0, 0, 0);
//     const end = new Date(date);
//     end.setHours(23, 59, 59, 999);

//     const entries = await this.prisma.timeEntry.findMany({
//       where: {
//         member: { userId, organizationId },
//         startTime: { gte: start, lte: end },
//       },
//       include: {
//         activities: {
//           select: { overall: true }, // Берем только % активности
//         },
//       },
//     });

//     const stats = entries.reduce(
//       (acc, curr) => {
//         // 1. Считаем время
//         let seconds = curr.duration;
//         if (curr.status === "RUNNING") {
//           seconds = Math.floor((Date.now() - curr.startTime.getTime()) / 1000);
//         }
//         acc.totalSeconds += seconds;

//         // 2. Считаем деньги (используем наш Snapshot)
//         const rate = curr.hourlyRateSnapshot || 0;
//         acc.totalCost += (seconds / 3600) * rate;

//         // 3. Собираем все очки активности для среднего
//         curr.activities.forEach((a) => {
//           acc.activityScores.push(a.overall);
//         });

//         return acc;
//       },
//       { totalSeconds: 0, totalCost: 0, activityScores: [] as number[] },
//     );

//     const avgActivity =
//       stats.activityScores.length > 0
//         ? Math.round(
//             stats.activityScores.reduce((a, b) => a + b, 0) /
//               stats.activityScores.length,
//           )
//         : 0;

//     return {
//       date: start,
//       formattedTime: this.formatSeconds(stats.totalSeconds),
//       totalSeconds: stats.totalSeconds,
//       totalCost: parseFloat(stats.totalCost.toFixed(2)),
//       averageActivity: avgActivity, // ТЕПЕРЬ ТУТ РЕАЛЬНЫЕ ЦИФРЫ
//       entriesCount: entries.length,
//     };
//   }

//   private formatSeconds(seconds: number): string {
//     const h = Math.floor(seconds / 3600);
//     const m = Math.floor((seconds % 3600) / 60);
//     const s = seconds % 60;
//     return [h, m, s].map((v) => (v < 10 ? "0" + v : v)).join(":");
//   }

//   async getAdminTeamStats(organizationId: string) {
//     const todayStart = new Date();
//     todayStart.setHours(0, 0, 0, 0);

//     // 1. Получаем всех активных участников организации
//     const members = await this.prisma.organizationMember.findMany({
//       where: {
//         organizationId,
//         status: "ACTIVE",
//       },
//       include: {
//         user: {
//           select: {
//             name: true,
//             email: true,
//             avatar: true,
//           },
//         },
//         timeEntries: {
//           where: {
//             startTime: { gte: todayStart },
//           },
//           include: {
//             activities: {
//               select: { overall: true },
//             },
//           },
//         },
//       },
//     });

//     // 2. Формируем статистику по каждому сотруднику
//     const teamStats = members.map((member) => {
//       const dailyEntries = member.timeEntries;

//       // Ищем, есть ли запущенный таймер прямо сейчас
//       const activeTimer = dailyEntries.find((e) => e.status === "RUNNING");

//       let totalSeconds = 0;
//       let activitySum = 0;
//       let activityCount = 0;

//       dailyEntries.forEach((entry) => {
//         // Считаем длительность (с учетом "тикающего" времени, если RUNNING)
//         let duration = entry.duration;
//         if (entry.status === "RUNNING") {
//           duration = Math.floor(
//             (Date.now() - entry.startTime.getTime()) / 1000,
//           );
//         }
//         totalSeconds += duration;

//         // Суммируем активность для среднего значения
//         if (entry.activities) {
//           entry.activities.forEach((a) => {
//             activitySum += a.overall;
//             activityCount++;
//           });
//         }
//       });

//       return {
//         memberId: member.id,
//         name: member.user.name,
//         email: member.user.email,
//         avatar: member.user.avatar,
//         role: member.role,
//         isOnline: !!activeTimer,
//         lastProjectId: activeTimer
//           ? activeTimer.projectId
//           : dailyEntries[0]?.projectId || null,
//         totalTimeToday: this.formatSeconds(totalSeconds),
//         totalSecondsToday: totalSeconds,
//         avgActivityToday:
//           activityCount > 0 ? Math.round(activitySum / activityCount) : 0,
//       };
//     });

//     return {
//       organizationId,
//       timestamp: new Date(),
//       totalTeamSeconds: teamStats.reduce(
//         (acc, m) => acc + m.totalSecondsToday,
//         0,
//       ),
//       members: teamStats,
//     };
//   }
// }
