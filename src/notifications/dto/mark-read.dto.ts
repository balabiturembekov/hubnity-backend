import { IsOptional, IsArray, IsUUID, ArrayMaxSize } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

const MAX_IDS = 100;

export class MarkReadDto {
  @ApiPropertyOptional({
    description: "ID уведомлений для отметки прочитанными. Если не указано — отметить все непрочитанные. Макс. 100 ID.",
    type: [String],
    example: ["uuid-1", "uuid-2"],
    maxItems: MAX_IDS,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_IDS, {
    message: `ids must contain at most ${MAX_IDS} items`,
  })
  @IsUUID("4", { each: true })
  ids?: string[];
}
