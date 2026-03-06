import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDate, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";

export class IdlePeriodDto {
  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endTime?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class IdlePeriodResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  startTime: Date;

  @ApiPropertyOptional()
  endTime: Date | null;

  @ApiPropertyOptional()
  duration: number | null;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiProperty()
  timeEntryId: string;
}
