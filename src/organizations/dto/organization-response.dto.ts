import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class OrganizationResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ example: "Acme Inc." })
  name: string;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  ownerId: string;

  @ApiPropertyOptional({ example: { theme: "dark" } })
  settings: Record<string, any> | null;

  @ApiProperty({ example: "UTC" })
  timezone: string;

  @ApiProperty({ example: "USD" })
  currency: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiPropertyOptional({ example: 5 })
  membersCount?: number;

  @ApiPropertyOptional({ example: 10 })
  projectsCount?: number;

  @ApiPropertyOptional({ example: 3 })
  clientsCount?: number;
}
