import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";

export function ApiAuth() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth("JWT-auth"),
    ApiResponse({ status: 401, description: "Unauthorized" }),
  );
}
