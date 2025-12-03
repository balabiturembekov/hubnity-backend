import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CreateAppActivityDto } from "./create-app-activity.dto";

export class BatchCreateAppActivityDto {
  @ApiProperty({
    description: "Массив данных о приложениях для batch создания",
    type: [CreateAppActivityDto],
    example: [
      {
        timeEntryId: "uuid",
        appName: "Visual Studio Code",
        windowTitle: "index.ts - Hubnity",
        timeSpent: 3600,
      },
      {
        timeEntryId: "uuid",
        appName: "Chrome",
        windowTitle: "GitHub",
        timeSpent: 1800,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "At least one app activity is required",
  })
  @ArrayMaxSize(100, {
    message: "Cannot create more than 100 app activities at once",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateAppActivityDto)
  activities: CreateAppActivityDto[];
}
