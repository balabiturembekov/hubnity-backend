import { IsOptional, IsBoolean, IsInt, Min, Max } from "class-validator";
import { Type, Transform } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class NotificationQueryDto {
  @ApiPropertyOptional({
    description: "Только непрочитанные",
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === "true" || value === true ? true : value === "false" || value === false ? false : undefined,
  )
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    description: "Лимит записей (1-100)",
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Смещение для пагинации",
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
