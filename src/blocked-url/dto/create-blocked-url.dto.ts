import { IsString, IsOptional, MaxLength, Matches } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBlockedUrlDto {
  @ApiPropertyOptional({
    description: "Конкретный URL для блокировки (точное совпадение)",
    example: "https://facebook.com",
    maxLength: 2048,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(2048, {
    message: "URL cannot exceed 2048 characters",
  })
  @Matches(/^https?:\/\/.+/, {
    message: "URL must start with http:// or https://",
  })
  url?: string;

  @ApiPropertyOptional({
    description: "Домен для блокировки (блокирует весь домен)",
    example: "facebook.com",
    maxLength: 255,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255, {
    message: "Domain cannot exceed 255 characters",
  })
  domain?: string;

  @ApiPropertyOptional({
    description: "Regex паттерн для сложных правил блокировки",
    example: ".*\\.(facebook|twitter)\\.com.*",
    maxLength: 500,
    type: String,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, {
    message: "Pattern cannot exceed 500 characters",
  })
  pattern?: string;
}
