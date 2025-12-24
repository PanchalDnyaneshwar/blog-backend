import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;
  private errorLogged = false;

  constructor(private configService: ConfigService) {
    const redisEnabled = this.configService.get('REDIS_ENABLED', 'true') === 'true';
    
    if (!redisEnabled) {
      this.logger.log('Redis is disabled. Caching will be skipped.');
      return;
    }

    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      retryStrategy: (times) => {
        // Stop retrying after 3 attempts
        if (times > 3) {
          if (!this.errorLogged) {
            this.logger.warn('Redis connection failed after 3 attempts. Continuing without cache.');
            this.errorLogged = true;
          }
          this.isConnected = false;
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false, // Don't queue commands when offline
    });

    // Handle connection events
    this.client.on('connect', () => {
      this.isConnected = true;
      this.errorLogged = false; // Reset on successful connection
      this.logger.log('✅ Redis connected');
    });

    this.client.on('error', (err: any) => {
      this.isConnected = false;
      // Only log first error to avoid spam
      if (!this.errorLogged) {
        const errorMessage = err?.message || err?.toString() || 'Unknown error';
        const errorCode = err?.code;
        
        if (errorCode === 'ECONNREFUSED' || errorMessage.includes('ECONNREFUSED')) {
          this.logger.warn('⚠️  Redis not available - continuing without cache. App will work normally, but caching is disabled. To enable: Install Redis or set REDIS_ENABLED=false in .env');
        } else {
          this.logger.warn(`⚠️  Redis error: ${errorMessage}. Continuing without cache.`);
        }
        this.errorLogged = true;
      }
    });

    this.client.on('close', () => {
      this.isConnected = false;
      // Don't log close events repeatedly
    });
  }

  async onModuleInit() {
    if (!this.client) return;
    
    try {
      await this.client.connect();
    } catch (err: any) {
      if (!this.errorLogged) {
        const errorMessage = err?.message || err?.toString() || 'Connection failed';
        if (errorMessage.includes('ECONNREFUSED') || err?.code === 'ECONNREFUSED') {
          this.logger.warn('⚠️  Redis not available - continuing without cache. App will work normally, but caching is disabled. To enable: Install Redis or set REDIS_ENABLED=false in .env');
        } else {
          this.logger.warn(`⚠️  Redis connection failed: ${errorMessage}. Continuing without cache.`);
        }
        this.errorLogged = true;
      }
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
      } catch (err) {
        // Ignore errors on shutdown
      }
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  isAvailable(): boolean {
    return this.isConnected && this.client !== null;
  }

  // Basic operations
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.get(key);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis get error: ${err.message}`);
      }
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      if (ttl) {
        await this.client!.setex(key, ttl, value);
      } else {
        await this.client!.set(key, value);
      }
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis set error: ${err.message}`);
      }
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.del(key);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis del error: ${err.message}`);
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis exists error: ${err.message}`);
      }
      return false;
    }
  }

  // Advanced operations
  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttl);
  }

  // Pattern-based operations (for cache invalidation)
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      const stream = this.client!.scanStream({
        match: pattern,
        count: 100,
      });

      let deletedCount = 0;
      const keys: string[] = [];

      return new Promise((resolve) => {
        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        stream.on('end', async () => {
          if (keys.length > 0) {
            deletedCount = await this.client!.del(...keys);
          }
          resolve(deletedCount);
        });

        stream.on('error', () => {
          resolve(0);
        });
      });
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis deletePattern error: ${err.message}`);
      }
      return 0;
    }
  }

  // Increment/Decrement operations (for counters, rate limiting)
  async increment(key: string, ttl?: number): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      const result = await this.client!.incr(key);
      if (ttl && result === 1) {
        // Set TTL only on first increment
        await this.client!.expire(key, ttl);
      }
      return result;
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis increment error: ${err.message}`);
      }
      return 0;
    }
  }

  async decrement(key: string): Promise<number> {
    if (!this.isAvailable()) return 0;
    try {
      return await this.client!.decr(key);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis decrement error: ${err.message}`);
      }
      return 0;
    }
  }

  async getNumber(key: string): Promise<number> {
    const value = await this.get(key);
    return value ? parseInt(value, 10) : 0;
  }

  // Hash operations (for storing objects)
  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.hset(key, field, value);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis hset error: ${err.message}`);
      }
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    if (!this.isAvailable()) return null;
    try {
      return await this.client!.hget(key, field);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis hget error: ${err.message}`);
      }
      return null;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    if (!this.isAvailable()) return {};
    try {
      return await this.client!.hgetall(key);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis hgetall error: ${err.message}`);
      }
      return {};
    }
  }

  async hdel(key: string, ...fields: string[]): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.hdel(key, ...fields);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis hdel error: ${err.message}`);
      }
    }
  }

  // Expire operations
  async expire(key: string, seconds: number): Promise<void> {
    if (!this.isAvailable()) return;
    try {
      await this.client!.expire(key, seconds);
    } catch (err: any) {
      if (!this.errorLogged) {
        this.logger.warn(`Redis expire error: ${err.message}`);
      }
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.isAvailable()) return -1;
    try {
      return await this.client!.ttl(key);
    } catch (err: any) {
      return -1;
    }
  }

  // Rate limiting helper
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (!this.isAvailable()) {
      // If Redis is not available, allow the request
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }

    try {
      const current = await this.getNumber(key);
      const resetAt = Date.now() + windowSeconds * 1000;

      if (current >= limit) {
        return { allowed: false, remaining: 0, resetAt };
      }

      const newCount = await this.increment(key, windowSeconds);
      const remaining = Math.max(0, limit - newCount);

      return { allowed: true, remaining, resetAt };
    } catch (err: any) {
      // On error, allow the request
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }
  }

  // Cache invalidation helpers
  async invalidatePostCache(slug?: string): Promise<void> {
    const promises: Promise<any>[] = [];
    
    if (slug) {
      promises.push(this.del(`post:${slug}`));
    }
    
    // Invalidate all post list caches
    promises.push(this.deletePattern('posts:list:*'));
    promises.push(this.deletePattern('posts:page:*'));
    
    // Invalidate related caches
    promises.push(this.del('categories:all'));
    promises.push(this.del('tags:all'));
    
    await Promise.all(promises);
  }

  async invalidateCategoryCache(): Promise<void> {
    await Promise.all([
      this.del('categories:all'),
      this.deletePattern('posts:list:*'),
    ]);
  }

  async invalidateTagCache(): Promise<void> {
    await Promise.all([
      this.del('tags:all'),
      this.deletePattern('posts:list:*'),
    ]);
  }
}
