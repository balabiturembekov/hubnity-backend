import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EventsGateway } from "../events/events.gateway";
import { CacheService } from "../cache/cache.service";

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {}

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
}
