import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsUUID,
  IsBoolean,
  IsOptional,
  IsDate,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";

export class ApproveTimeEntryDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID("4", { each: true })
  timeEntryIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  approved?: boolean = true;
}

export class LockPeriodDto {
  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ApiPropertyOptional()
  @IsOptional()
  reason?: string;
}

export class TimeEditLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timeEntryId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  changedAt: Date;

  @ApiProperty()
  oldValues: any;

  @ApiProperty()
  newValues: any;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  userAgent?: string;

  @ApiPropertyOptional()
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}
