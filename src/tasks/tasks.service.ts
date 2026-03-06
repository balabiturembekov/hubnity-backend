// import { PrismaService } from "@/prisma/prisma.service";
// import { ForbiddenException, Injectable } from "@nestjs/common";
// import { CreateTaskDto } from "./dto/create-task.dto";

// @Injectable()
// export class TasksService {
//   constructor(private readonly prisma: PrismaService) {}

//   async create(dto: CreateTaskDto, userId: string) {
//     // Проверяем, есть ли у юзера доступ к этому проекту через ProjectMember
//     const projectMember = await this.prisma.projectMember.findFirst({
//       where: {
//         projectId: dto.projectId,
//         userId: userId,
//       },
//     });

//     if (!projectMember) {
//       throw new ForbiddenException("У вас нет доступа к этому проекту");
//     }

//     return this.prisma.task.create({
//       data: {
//         name: dto.name,
//         description: dto.description,
//         projectId: dto.projectId,
//       },
//     });
//   }

//   async getProjectTasks(projectId: string) {
//     return this.prisma.task.findMany({
//       where: { projectId },
//       orderBy: { createdAt: "desc" },
//     });
//   }
// }
