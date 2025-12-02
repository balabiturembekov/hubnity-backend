import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsBoolean } from "class-validator";

export class HeartbeatDto {
  @ApiProperty({
    description: "Флаг активности пользователя (опционально)",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
