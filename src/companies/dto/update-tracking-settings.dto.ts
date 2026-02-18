import {
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

/**
 * DTO for updating company tracking policies.
 * Used by Desktop app admin (OWNER/ADMIN) to configure tracking rules.
 */
export class UpdateTrackingSettingsDto {
  @ApiPropertyOptional({
    description:
      "Screenshot capture interval in minutes (1-60). Min 1 prevents DDOS from excessive polling.",
    example: 10,
    minimum: 1,
    maximum: 60,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "screenshotIntervalMinutes must be at least 1" })
  @Max(60, { message: "screenshotIntervalMinutes cannot exceed 60" })
  screenshotIntervalMinutes?: number;

  @ApiPropertyOptional({
    description: "Whether to allow blurring screenshots for privacy",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  allowBlurScreenshots?: boolean;

  @ApiPropertyOptional({
    description: "Idle timeout in minutes before auto-pause (1-60)",
    example: 5,
    minimum: 1,
    maximum: 60,
    default: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: "idleTimeoutMinutes must be at least 1" })
  @Max(60, { message: "idleTimeoutMinutes cannot exceed 60" })
  idleTimeoutMinutes?: number;

  @ApiPropertyOptional({
    description: "Whether to track app and URL activity",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  trackAppsAndUrls?: boolean;

  @ApiPropertyOptional({
    description: "Whether screenshots are enabled",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  screenshotEnabled?: boolean;

  @ApiPropertyOptional({
    description: "Whether idle detection is enabled",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  idleDetectionEnabled?: boolean;
}
