import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateOrganizationGoalDto {
  @ApiProperty({ example: "Increase revenue", description: "Goal title" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: "Target 20% growth",
    description: "Goal subtitle",
  })
  @IsString()
  @IsNotEmpty()
  subTitle: string;

  @ApiProperty({
    example: false,
    description: "Whether the goal is marked as popular",
    default: false,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isPopular?: boolean = false;
}
