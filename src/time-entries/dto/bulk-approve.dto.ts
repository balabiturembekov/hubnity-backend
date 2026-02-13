import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID, ArrayMinSize } from "class-validator";

export class BulkApproveDto {
  @ApiProperty({
    description: "Массив ID записей времени для утверждения",
    example: ["uuid-1", "uuid-2"],
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  ids: string[];
}
