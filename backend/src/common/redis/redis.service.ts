import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://127.0.0.1:6379');
    try {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy(times) {
          return Math.min(times * 100, 3000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.logger.log('Redis connected successfully');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.warn(`Redis connection warning: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize Redis client: ${err?.message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;
    try {
      const data = await this.client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.client || !this.isConnected) return false;
    try {
      await this.client.del(key);
      return true;
    } catch {
      return false;
    }
  }

  async delPattern(pattern: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      const stream = this.client.scanStream({ match: pattern, count: 50 });
      stream.on('data', async (keys: string[]) => {
        if (keys.length > 0) {
          const pipeline = this.client?.pipeline();
          keys.forEach((k) => pipeline?.del(k));
          await pipeline?.exec();
        }
      });
    } catch {
      // safe fallback
    }
  }
}
