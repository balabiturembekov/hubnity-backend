import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ArrayMinSize,
} from "class-validator";

export class BulkRejectDto {
  @ApiProperty({
    description: "Массив ID записей времени для отклонения",
    example: ["uuid-1", "uuid-2"],
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  ids: string[];

  @ApiPropertyOptional({
    description: "Общий комментарий при отклонении (применяется ко всем)",
    example: "Требуется уточнение",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionComment?: string;
}
