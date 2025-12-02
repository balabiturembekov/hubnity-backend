import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: "Health check",
    description: "Проверка работоспособности API",
  })
  @ApiResponse({
    status: 200,
    description: "API работает",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Hubnity API is running!",
        },
      },
    },
  })
  getHello(): string {
    return this.appService.getHello();
  }
}
