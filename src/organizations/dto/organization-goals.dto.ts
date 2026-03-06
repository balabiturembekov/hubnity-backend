import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID, ArrayMaxSize } from "class-validator";

export class AddOrganizationGoalsDto {
  @ApiProperty({
    description: "Organization goal IDs (from the global goals catalog) to add to the organization",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000"],
    maxItems: 50,
  })
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("4", { each: true })
  goalIds: string[];
}
