import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class AppService implements OnModuleInit {
  onModuleInit() {}

  getHello(): string {
    return "Hubnity API is running!";
  }
}
