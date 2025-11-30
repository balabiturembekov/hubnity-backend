import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {}

  async getScreenshotSettings(companyId: string) {
    if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
      throw new NotFoundException('Invalid company ID');
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
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const settings = {
      screenshotEnabled: company.screenshotEnabled,
      screenshotInterval: company.screenshotInterval,
    };

    await this.cache.set(cacheKey, settings, 600);
    return settings;
  }

  async updateScreenshotSettings(companyId: string, settings: { screenshotEnabled?: boolean; screenshotInterval?: number }) {
    if (settings.screenshotEnabled !== undefined && typeof settings.screenshotEnabled !== 'boolean') {
      throw new ForbiddenException('screenshotEnabled must be a boolean value');
    }

    if (settings.screenshotInterval !== undefined) {
      if (typeof settings.screenshotInterval !== 'number' || !Number.isInteger(settings.screenshotInterval) || isNaN(settings.screenshotInterval)) {
        throw new ForbiddenException('screenshotInterval must be an integer');
      }

      if (settings.screenshotInterval <= 0) {
        throw new ForbiddenException('screenshotInterval must be a positive integer');
      }

      const validIntervals = [30, 60, 300, 600];
      if (!validIntervals.includes(settings.screenshotInterval)) {
        throw new ForbiddenException('Invalid screenshot interval. Allowed values: 30, 60, 300, 600 seconds');
      }
    }

    const updateData: any = {};
    if (settings.screenshotEnabled !== undefined) {
      updateData.screenshotEnabled = settings.screenshotEnabled;
    }
    if (settings.screenshotInterval !== undefined) {
      updateData.screenshotInterval = settings.screenshotInterval;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getScreenshotSettings(companyId);
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
    this.eventsGateway.broadcastScreenshotSettingsUpdate(updatedSettings, companyId);

    return updatedSettings;
  }
}

