import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { CacheService } from "../cache/cache.service";
import { UpdateTrackingSettingsDto } from "./dto/update-tracking-settings.dto";

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {}

  async getCompanyProfile(companyId: string) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const cacheKey = `company:${companyId}:profile`;
    const cached = await this.cache.get<{
      id: string;
      name: string;
      domain: string | null;
      screenshotEnabled: boolean;
      screenshotInterval: number;
      idleDetectionEnabled: boolean;
      idleThreshold: number;
      createdAt: Date;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        domain: true,
        screenshotEnabled: true,
        screenshotInterval: true,
        idleDetectionEnabled: true,
        idleThreshold: true,
        createdAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const profile = {
      id: company.id,
      name: company.name,
      domain: company.domain,
      screenshotEnabled: company.screenshotEnabled,
      screenshotInterval: company.screenshotInterval,
      idleDetectionEnabled: company.idleDetectionEnabled,
      idleThreshold: company.idleThreshold,
      createdAt: company.createdAt,
    };

    await this.cache.set(cacheKey, profile, 600);
    return profile;
  }

  async updateCompanyProfile(
    companyId: string,
    data: { name?: string; domain?: string | null },
  ) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const updateData: { name?: string; domain?: string | null } = {};
    if (data.name !== undefined) {
      if (
        typeof data.name !== "string" ||
        data.name.trim().length < 2 ||
        data.name.length > 255
      ) {
        throw new ForbiddenException(
          "Company name must be between 2 and 255 characters",
        );
      }
      updateData.name = data.name.trim();
    }
    if (data.domain !== undefined) {
      if (data.domain === null || data.domain === "") {
        updateData.domain = null;
      } else if (typeof data.domain === "string") {
        const trimmed = data.domain.trim();
        if (trimmed.length > 255) {
          throw new ForbiddenException(
            "Domain must not exceed 255 characters",
          );
        }
        updateData.domain = trimmed || null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return this.getCompanyProfile(companyId);
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existingCompany) {
      throw new NotFoundException("Company not found");
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        id: true,
        name: true,
        domain: true,
        screenshotEnabled: true,
        screenshotInterval: true,
        idleDetectionEnabled: true,
        idleThreshold: true,
        createdAt: true,
      },
    });

    await this.cache.del(`company:${companyId}:profile`);
    await this.cache.invalidateCompanySettings(companyId);

    return {
      id: company.id,
      name: company.name,
      domain: company.domain,
      screenshotEnabled: company.screenshotEnabled,
      screenshotInterval: company.screenshotInterval,
      idleDetectionEnabled: company.idleDetectionEnabled,
      idleThreshold: company.idleThreshold,
      createdAt: company.createdAt,
    };
  }

  async getScreenshotSettings(companyId: string) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const cacheKey = `company:${companyId}:settings`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        screenshotEnabled: true,
        screenshotInterval: true,
        idleDetectionEnabled: true,
        idleThreshold: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const settings = {
      screenshotEnabled: company.screenshotEnabled,
      screenshotInterval: company.screenshotInterval,
      idleDetectionEnabled: company.idleDetectionEnabled,
      idleThreshold: company.idleThreshold,
    };

    await this.cache.set(cacheKey, settings, 600);
    return settings;
  }

  async getIdleDetectionSettings(companyId: string) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        idleDetectionEnabled: true,
        idleThreshold: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    return {
      idleDetectionEnabled: company.idleDetectionEnabled,
      idleThreshold: company.idleThreshold,
    };
  }

  async updateIdleDetectionSettings(
    companyId: string,
    settings: { idleDetectionEnabled?: boolean; idleThreshold?: number },
  ) {
    if (
      settings.idleDetectionEnabled !== undefined &&
      typeof settings.idleDetectionEnabled !== "boolean"
    ) {
      throw new ForbiddenException(
        "idleDetectionEnabled must be a boolean value",
      );
    }

    if (settings.idleThreshold !== undefined) {
      if (
        typeof settings.idleThreshold !== "number" ||
        !Number.isInteger(settings.idleThreshold) ||
        isNaN(settings.idleThreshold)
      ) {
        throw new ForbiddenException("idleThreshold must be an integer");
      }

      if (settings.idleThreshold < 60) {
        throw new ForbiddenException(
          "idleThreshold must be at least 60 seconds (1 minute)",
        );
      }

      if (settings.idleThreshold > 3600) {
        throw new ForbiddenException(
          "idleThreshold cannot exceed 3600 seconds (1 hour)",
        );
      }
    }

    const updateData: {
      idleDetectionEnabled?: boolean;
      idleThreshold?: number;
    } = {};
    if (settings.idleDetectionEnabled !== undefined) {
      updateData.idleDetectionEnabled = settings.idleDetectionEnabled;
    }
    if (settings.idleThreshold !== undefined) {
      updateData.idleThreshold = settings.idleThreshold;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getIdleDetectionSettings(companyId);
    }

    // Check if company exists before updating
    const existingCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existingCompany) {
      throw new NotFoundException("Company not found");
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        idleDetectionEnabled: true,
        idleThreshold: true,
      },
    });

    await this.cache.invalidateCompanySettings(companyId);

    return {
      idleDetectionEnabled: company.idleDetectionEnabled,
      idleThreshold: company.idleThreshold,
    };
  }

  async updateScreenshotSettings(
    companyId: string,
    settings: { screenshotEnabled?: boolean; screenshotInterval?: number },
  ) {
    if (
      settings.screenshotEnabled !== undefined &&
      typeof settings.screenshotEnabled !== "boolean"
    ) {
      throw new ForbiddenException("screenshotEnabled must be a boolean value");
    }

    if (settings.screenshotInterval !== undefined) {
      if (
        typeof settings.screenshotInterval !== "number" ||
        !Number.isInteger(settings.screenshotInterval) ||
        isNaN(settings.screenshotInterval)
      ) {
        throw new ForbiddenException("screenshotInterval must be an integer");
      }

      if (settings.screenshotInterval <= 0) {
        throw new ForbiddenException(
          "screenshotInterval must be a positive integer",
        );
      }

      const validIntervals = [30, 60, 300, 600];
      if (!validIntervals.includes(settings.screenshotInterval)) {
        throw new ForbiddenException(
          "Invalid screenshot interval. Allowed values: 30, 60, 300, 600 seconds",
        );
      }
    }

    const updateData: {
      screenshotEnabled?: boolean;
      screenshotInterval?: number;
    } = {};
    if (settings.screenshotEnabled !== undefined) {
      updateData.screenshotEnabled = settings.screenshotEnabled;
    }
    if (settings.screenshotInterval !== undefined) {
      updateData.screenshotInterval = settings.screenshotInterval;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getScreenshotSettings(companyId);
    }

    // Check if company exists before updating
    const existingCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existingCompany) {
      throw new NotFoundException("Company not found");
    }

    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        screenshotEnabled: true,
        screenshotInterval: true,
      },
    });

    const updatedSettings = {
      screenshotEnabled: company.screenshotEnabled,
      screenshotInterval: company.screenshotInterval,
    };

    await this.cache.invalidateCompanySettings(companyId);
    await this.cache.set(`company:${companyId}:settings`, updatedSettings, 600);
    this.eventsGateway.broadcastScreenshotSettingsUpdate(
      updatedSettings,
      companyId,
    );

    return updatedSettings;
  }

  /**
   * Get tracking policy settings for Desktop app.
   * Accessible by all employees. Cached for performance.
   */
  async getTrackingSettings(companyId: string) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const cacheKey = `company:${companyId}:tracking-settings`;
    const cached = await this.cache.get<{
      screenshotIntervalMinutes: number;
      allowBlurScreenshots: boolean;
      idleTimeoutMinutes: number;
      trackAppsAndUrls: boolean;
      screenshotEnabled: boolean;
      idleDetectionEnabled: boolean;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        screenshotEnabled: true,
        screenshotInterval: true,
        screenshotIntervalMinutes: true,
        allowBlurScreenshots: true,
        idleThreshold: true,
        idleTimeoutMinutes: true,
        idleDetectionEnabled: true,
        trackAppsAndUrls: true,
      },
    });

    if (!company) {
      throw new NotFoundException("Company not found");
    }

    const settings = {
      screenshotIntervalMinutes:
        (company.screenshotIntervalMinutes ?? Math.round(company.screenshotInterval / 60)) || 10,
      allowBlurScreenshots: company.allowBlurScreenshots ?? true,
      idleTimeoutMinutes:
        (company.idleTimeoutMinutes ?? Math.round(company.idleThreshold / 60)) || 5,
      trackAppsAndUrls: company.trackAppsAndUrls ?? true,
      screenshotEnabled: company.screenshotEnabled,
      idleDetectionEnabled: company.idleDetectionEnabled,
    };

    await this.cache.set(cacheKey, settings, 300); // 5 min TTL - Desktop app polls periodically
    return settings;
  }

  /**
   * Update tracking policy settings. OWNER/ADMIN only.
   * Syncs idleTimeoutMinutes -> idleThreshold (seconds) for backend services.
   * Invalidates Redis cache (profile, settings, tracking-settings).
   */
  async updateTrackingSettings(
    companyId: string,
    dto: UpdateTrackingSettingsDto,
  ) {
    if (
      !companyId ||
      typeof companyId !== "string" ||
      companyId.trim() === ""
    ) {
      throw new NotFoundException("Invalid company ID");
    }

    const updateData: {
      screenshotIntervalMinutes?: number;
      screenshotInterval?: number;
      allowBlurScreenshots?: boolean;
      idleTimeoutMinutes?: number;
      idleThreshold?: number;
      trackAppsAndUrls?: boolean;
      screenshotEnabled?: boolean;
      idleDetectionEnabled?: boolean;
    } = {};

    if (dto.screenshotIntervalMinutes !== undefined) {
      updateData.screenshotIntervalMinutes = dto.screenshotIntervalMinutes;
      // Sync legacy screenshotInterval (seconds) for existing backend consumers
      updateData.screenshotInterval = dto.screenshotIntervalMinutes * 60;
    }
    if (dto.allowBlurScreenshots !== undefined) {
      updateData.allowBlurScreenshots = dto.allowBlurScreenshots;
    }
    if (dto.idleTimeoutMinutes !== undefined) {
      updateData.idleTimeoutMinutes = dto.idleTimeoutMinutes;
      // Sync idleThreshold (seconds) for idle-detection service
      updateData.idleThreshold = dto.idleTimeoutMinutes * 60;
    }
    if (dto.trackAppsAndUrls !== undefined) {
      updateData.trackAppsAndUrls = dto.trackAppsAndUrls;
    }
    if (dto.screenshotEnabled !== undefined) {
      updateData.screenshotEnabled = dto.screenshotEnabled;
    }
    if (dto.idleDetectionEnabled !== undefined) {
      updateData.idleDetectionEnabled = dto.idleDetectionEnabled;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getTrackingSettings(companyId);
    }

    const existingCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existingCompany) {
      throw new NotFoundException("Company not found");
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });

    await this.cache.invalidateCompanySettings(companyId);

    return this.getTrackingSettings(companyId);
  }
}
