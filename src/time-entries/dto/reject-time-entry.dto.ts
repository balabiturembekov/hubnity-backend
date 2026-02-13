import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectTimeEntryDto {
  @ApiPropertyOptional({
    description: "Комментарий при отклонении",
    example: "Недостаточно деталей в описании",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionComment?: string;
}
