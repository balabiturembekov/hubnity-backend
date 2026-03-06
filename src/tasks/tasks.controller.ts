// import { Body, Controller, Get, Post, Query } from "@nestjs/common";
// import { TasksService } from "./tasks.service";
// import { CreateTaskDto } from "./dto/create-task.dto";

// @Controller("tasks")
// export class TasksController {
//   constructor(private readonly tasksService: TasksService) {}

//   @Post()
//   async create(@Body() dto: CreateTaskDto) {
//     const tempUserId = "8b880d00-3809-483a-8d48-9008f425e490";
//     return this.tasksService.create(dto, tempUserId);
//   }

//   @Get()
//   async getTasks(@Query("projectId") projectId: string) {
//     return this.tasksService.getProjectTasks(projectId);
//   }
// }
