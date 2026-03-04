// ==================== HOLIDAY DTOs ====================

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsDate,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateHolidayDto {
  @ApiProperty({ description: "Holiday name", example: "New Year" })
  @IsString({ message: "Name must be a string" })
  @IsNotEmpty({ message: "Holiday name is required" })
  @MinLength(2, { message: "Holiday name must be at least 2 characters" })
  @MaxLength(100, { message: "Holiday name cannot exceed 100 characters" })
  name: string;

  @ApiProperty({
    description: "Holiday date",
    example: "2024-01-01T00:00:00.000Z",
  })
  @IsDate({ message: "Date must be a valid date" })
  @IsNotEmpty({ message: "Date is required" })
  date: Date; // Приходит как строка, преобразуется в Date

  @IsBoolean()
  @IsOptional()
  recurring?: boolean = false;

  @ApiPropertyOptional({
    description: "Whether holiday repeats yearly",
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: "Recurring must be a boolean" })
  organizationId: string;
}

export class UpdateHolidayDto {
  @ApiPropertyOptional({ description: "Holiday name", example: "New Year" })
  @IsOptional()
  @IsString({ message: "Name must be a string" })
  @MinLength(2, { message: "Holiday name must be at least 2 characters" })
  @MaxLength(100, { message: "Holiday name cannot exceed 100 characters" })
  name?: string;

  @ApiPropertyOptional({
    description: "Holiday date",
    example: "2024-01-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsDate({ message: "Date must be a valid date" })
  date?: string;

  @ApiPropertyOptional({
    description: "Whether holiday repeats yearly",
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: "Recurring must be a boolean" })
  recurring?: boolean;
}

export class HolidayResponseDto {
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @ApiProperty({ example: "New Year" })
  name: string;

  @ApiProperty({ example: "2024-01-01T00:00:00.000Z" })
  date: Date;

  @ApiProperty({ example: true })
  recurring: boolean;

  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  organizationId: string;
}

export class HolidayFilterDto {
  @ApiPropertyOptional({ example: 2024 })
  @IsOptional()
  @IsNumber({}, { message: "Year must be a number" })
  @MinLength(2000, { message: "Year must be at least 2000" })
  @MaxLength(2100, { message: "Year cannot exceed 2100" })
  year?: number;
}
