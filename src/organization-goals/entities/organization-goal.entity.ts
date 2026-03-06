import { ApiProperty } from "@nestjs/swagger";

export class OrganizationGoal {}

export class OrganizationGoalEntity {
  @ApiProperty({ example: "uuid", description: "Organization goal ID" })
  id: string;

  @ApiProperty({ example: "Increase revenue", description: "Goal title" })
  title: string;

  @ApiProperty({
    example: "Target 20% growth",
    description: "Goal subtitle",
  })
  subTitle: string;

  @ApiProperty({
    example: false,
    description: "Whether the goal is marked as popular",
  })
  isPopular: boolean;
}
