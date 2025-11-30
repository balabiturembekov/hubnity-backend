import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsGateway } from '../events.gateway';
import { CacheService } from '../../cache/cache.service';

@Processor('stats')
export class StatsProcessor extends WorkerHost {
  private readonly logger = new Logger(StatsProcessor.name);

  constructor(
    private prisma: PrismaService,
    private eventsGateway: EventsGateway,
    private cache: CacheService,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.debug(`Processing stats job ${job.id}`);

    try {
      const companyId = job.data?.companyId;

      if (!companyId) {
        this.logger.warn(`Stats job ${job.id} has no companyId - skipping to prevent data leak`);
        return null;
      }

      const cacheKey = `stats:${companyId}`;
      const cachedStats = await this.cache.get(cacheKey);

      if (cachedStats) {
        this.logger.debug(`Using cached stats for company ${companyId}`);
        this.eventsGateway.broadcastStatsUpdate(cachedStats, companyId);
        return cachedStats;
      }

      const now = new Date();

      const totalEntries = await this.prisma.timeEntry.findMany({
        where: {
          user: {
            companyId,
          },
        },
        select: { id: true, duration: true, status: true, startTime: true },
      });

      const totalSeconds = totalEntries.reduce((acc, entry) => {
        let entrySeconds = 0;

        if (entry.status === 'STOPPED') {
          entrySeconds = entry.duration ?? 0;
        } else if (entry.status === 'RUNNING') {
          try {
            const start = new Date(entry.startTime).getTime();
            const elapsed = Math.floor((now.getTime() - start) / 1000);
            
            // Log warning if elapsed time is negative (possible clock sync issue)
            if (elapsed < 0) {
              this.logger.warn(
                {
                  entryId: entry.id,
                  startTime: entry.startTime,
                  now: now.toISOString(),
                  elapsed,
                },
                'Negative elapsed time detected in stats calculation - possible clock synchronization issue',
              );
            }
            
            entrySeconds = (entry.duration ?? 0) + Math.max(0, elapsed);
          } catch {
            entrySeconds = entry.duration ?? 0;
          }
        } else if (entry.status === 'PAUSED') {
          entrySeconds = entry.duration ?? 0;
        }

        return acc + (isFinite(entrySeconds) && entrySeconds >= 0 ? entrySeconds : 0);
      }, 0);

      const totalHours = totalSeconds / 3600;

      const activeEntries = await this.prisma.timeEntry.findMany({
        where: {
          status: {
            in: ['RUNNING', 'PAUSED'],
          },
          user: {
            companyId,
          },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      const activeUsers = activeEntries.length;

      const totalProjects = await this.prisma.project.count({
        where: {
          status: 'ACTIVE',
          companyId,
        },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const todayEntries = await this.prisma.timeEntry.findMany({
        where: {
          startTime: {
            gte: todayStart,
            lte: todayEnd,
          },
          user: {
            companyId,
          },
        },
        select: { duration: true, status: true, startTime: true },
      });

      const todaySeconds = todayEntries.reduce((acc, entry) => {
        let entrySeconds = 0;

        if (entry.status === 'STOPPED') {
          entrySeconds = entry.duration ?? 0;
        } else if (entry.status === 'RUNNING') {
          try {
            const start = new Date(entry.startTime).getTime();
            const elapsed = Math.floor((now.getTime() - start) / 1000);
            entrySeconds = (entry.duration ?? 0) + Math.max(0, elapsed);
          } catch {
            entrySeconds = entry.duration ?? 0;
          }
        } else if (entry.status === 'PAUSED') {
          entrySeconds = entry.duration ?? 0;
        }

        return acc + (isFinite(entrySeconds) && entrySeconds >= 0 ? entrySeconds : 0);
      }, 0);

      const todayHours = todaySeconds / 3600;

      const stats = {
        totalHours,
        activeUsers,
        totalProjects,
        todayHours,
      };

      await this.cache.set(cacheKey, stats, 30);
      this.eventsGateway.broadcastStatsUpdate(stats, companyId);

      return stats;
    } catch (error: any) {
      this.logger.error(`Error processing stats job: ${error.message}`);
      throw error;
    }
  }
}

