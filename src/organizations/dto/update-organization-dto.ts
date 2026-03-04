import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateOrganizationDto {
  @ApiPropertyOptional({
    description: "Organization name",
    example: "Acme Inc.",
  })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Organization name must be at least 2 characters" })
  @MaxLength(100, { message: "Organization name cannot exceed 100 characters" })
  name?: string;

  @ApiPropertyOptional({
    description: "Organization settings",
    example: { theme: "dark" },
  })
  @IsOptional()
  @IsObject({ message: "Settings must be an object" })
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: "Timezone", example: "UTC" })
  @IsOptional()
  @IsString({ message: "Timezone must be a string" })
  timezone?: string;

  @ApiPropertyOptional({ description: "Currency", example: "USD" })
  @IsOptional()
  @IsString({ message: "Currency must be a string" })
  @MinLength(3, { message: "Currency code must be 3 characters" })
  @MaxLength(3, { message: "Currency code must be 3 characters" })
  currency?: string;
}
