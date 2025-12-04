import {
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { CreateUrlActivityDto } from "./create-url-activity.dto";

export class BatchCreateUrlActivityDto {
  @ApiProperty({
    description: "Массив данных о URL для batch создания",
    type: [CreateUrlActivityDto],
    example: [
      {
        timeEntryId: "uuid",
        url: "https://github.com/user/repo",
        domain: "github.com",
        title: "GitHub Repository",
        timeSpent: 1800,
      },
      {
        timeEntryId: "uuid",
        url: "https://stackoverflow.com/questions/123",
        domain: "stackoverflow.com",
        title: "Stack Overflow Question",
        timeSpent: 900,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: "At least one URL activity is required",
  })
  @ArrayMaxSize(100, {
    message: "Cannot create more than 100 URL activities at once",
  })
  @ValidateNested({ each: true })
  @Type(() => CreateUrlActivityDto)
  activities: CreateUrlActivityDto[];
}
