import { IsOptional, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { AnalyticsQueryDto } from "./analytics-query.dto";

export enum ExportFormat {
  CSV = "csv",
}

export class ExportQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: "Формат экспорта",
    enum: ExportFormat,
    default: ExportFormat.CSV,
  })
  @IsOptional()
  @IsEnum(ExportFormat)
  format?: ExportFormat = ExportFormat.CSV;
}
