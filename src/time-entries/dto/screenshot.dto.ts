import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsUUID, IsInt, Min } from "class-validator";
import { Transform } from "class-transformer";

export class UploadScreenshotDto {
  @ApiPropertyOptional({ description: "Blur the screenshot", default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  isBlurred?: boolean;

  @ApiPropertyOptional({
    description: "Activity data (mouse clicks, keyboard)",
    type: "object",
    additionalProperties: true,
    properties: {
      mouseClicks: { type: "number" },
      keyboardStrokes: { type: "number" },
      mouseDistance: { type: "number" },
    },
  })
  @IsOptional()
  activityData?: {
    mouseClicks?: number;
    keyboardStrokes?: number;
    mouseDistance?: number;
  };
}

export class ScreenshotResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  url: string;

  @ApiProperty()
  takenAt: Date;

  @ApiProperty()
  isBlurred: boolean;

  @ApiProperty()
  timeEntryId: string;

  @ApiPropertyOptional()
  timeEntry?: {
    id: string;
    startTime: Date;
    endTime?: Date;
    description?: string;
  };
}

export class ScreenshotFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  timeEntryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
