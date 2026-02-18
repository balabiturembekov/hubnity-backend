import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(CacheService.name);
  private readonly defaultTTL = 300;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    try {
      const redisHost = this.configService.get("REDIS_HOST") || "localhost";
      const redisPort = parseInt(
        this.configService.get("REDIS_PORT") || "6379",
        10,
      );
      const redisPassword =
        this.configService.get("REDIS_PASSWORD") || undefined;

      this.client = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.client.on("error", (err) => {
        this.logger.error("Redis Client Error:", err);
      });

      this.client.on("connect", () => {
        this.logger.log("Redis Client Connected");
      });

      await this.client.ping();
    } catch (error) {
      this.logger.warn(
        "Failed to connect to Redis, caching will be disabled:",
        error,
      );
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  isAvailable(): boolean {
    return this.client !== null && this.client.status === "ready";
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }
    try {
      const value = await this.client!.get(key);
      if (value) {
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttl: number = this.defaultTTL,
  ): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.client!.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.warn(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      await this.client!.del(key);
    } catch (error) {
      this.logger.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }
    try {
      const stream = this.client!.scanStream({
        match: pattern,
        count: 100,
      });

      const keys: string[] = [];
      stream.on("data", (resultKeys: string[]) => {
        keys.push(...resultKeys);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
    } catch (error) {
      this.logger.warn(`Cache delete pattern error for ${pattern}:`, error);
    }
  }

  async invalidateProjects(companyId: string): Promise<void> {
    await this.delPattern(`projects:${companyId}:*`);
  }

  async invalidateUsers(companyId: string): Promise<void> {
    await this.delPattern(`users:${companyId}:*`);
  }

  async invalidateCompanySettings(companyId: string): Promise<void> {
    await this.del(`company:${companyId}:settings`);
    await this.del(`company:${companyId}:tracking-settings`);
    await this.del(`company:${companyId}:profile`);
  }

  async invalidateStats(companyId: string): Promise<void> {
    await this.del(`stats:${companyId}`);
  }
}
