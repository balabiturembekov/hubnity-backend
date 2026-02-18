import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from "@nestjs/swagger";
import { CompaniesService } from "./companies.service";
import { UpdateTrackingSettingsDto } from "./dto/update-tracking-settings.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { GetUser } from "../auth/decorators/get-user.decorator";
import { UserRole } from "@prisma/client";

/**
 * Company settings controller for Desktop app integration.
 * GET /companies/settings - All employees (Desktop app fetches on startup).
 * PATCH /companies/settings - OWNER/ADMIN only (change tracking rules).
 */
@ApiTags("companies")
@Controller("companies")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth("JWT-auth")
export class CompanySettingsController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get("settings")
  @ApiOperation({
    summary: "Get tracking policy settings",
    description:
      "Returns tracking policy settings for the Desktop app. Accessible by all employees. " +
      "Cache TTL: 5 minutes. Desktop app should call on startup and periodically to pick up changes.",
  })
  @ApiResponse({
    status: 200,
    description: "Tracking policy settings",
    schema: {
      type: "object",
      properties: {
        screenshotIntervalMinutes: {
          type: "number",
          example: 10,
          description: "Screenshot capture interval in minutes",
        },
        allowBlurScreenshots: {
          type: "boolean",
          example: true,
          description: "Whether blurring screenshots is allowed",
        },
        idleTimeoutMinutes: {
          type: "number",
          example: 5,
          description: "Idle timeout in minutes before auto-pause",
        },
        trackAppsAndUrls: {
          type: "boolean",
          example: true,
          description: "Whether to track app and URL activity",
        },
        screenshotEnabled: {
          type: "boolean",
          example: true,
          description: "Whether screenshots are enabled",
        },
        idleDetectionEnabled: {
          type: "boolean",
          example: true,
          description: "Whether idle detection is enabled",
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Company not found" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getSettings(@GetUser() user: any) {
    return this.companiesService.getTrackingSettings(user.companyId);
  }

  @Patch("settings")
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Update tracking policy settings",
    description:
      "Updates tracking rules. OWNER/ADMIN only. Changes sync to idleThreshold and screenshotInterval for backend.",
  })
  @ApiBody({ type: UpdateTrackingSettingsDto })
  @ApiResponse({
    status: 200,
    description: "Settings updated",
    schema: {
      type: "object",
      properties: {
        screenshotIntervalMinutes: { type: "number" },
        allowBlurScreenshots: { type: "boolean" },
        idleTimeoutMinutes: { type: "number" },
        trackAppsAndUrls: { type: "boolean" },
        screenshotEnabled: { type: "boolean" },
        idleDetectionEnabled: { type: "boolean" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid request body" })
  @ApiResponse({ status: 403, description: "Forbidden - not owner/admin" })
  @ApiResponse({ status: 404, description: "Company not found" })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async updateSettings(
    @GetUser() user: any,
    @Body() dto: UpdateTrackingSettingsDto,
  ) {
    return this.companiesService.updateTrackingSettings(user.companyId, dto);
  }
}
