import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../logging/logger';

/**
 * Redis Cache Implementation
 * Production-ready cache with Redis backend
 */
export class RedisCache {
  private client: Redis | null = null;
  private isConnected = false;

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.client = new Redis(config.redis.url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 100, 3000);
        },
      });

      await this.client.connect();

      this.client.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.client.on('connect', () => {
        logger.info('Redis connected');
      });

      this.client.on('close', () => {
        logger.info('Redis connection closed');
        this.isConnected = false;
      });

      this.isConnected = true;
      logger.info('Redis cache initialized', { url: config.redis.url.replace(/\/\/.*@/, '//***@') });
    } catch (error) {
      logger.error('Failed to connect to Redis', { error });
      throw error;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;

    try {
      const value = await this.client.get(key);
      if (!value) {
        logger.debug('Cache miss', { key });
        return null;
      }

      logger.debug('Cache hit', { key });
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;

    try {
      const ttl = ttlSeconds ?? config.cache.ttl;
      const serialized = JSON.stringify(value);
      
      await this.client.setex(key, ttl, serialized);
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Redis set error', { key, error });
    }
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.del(key);
      if (result > 0) {
        logger.debug('Cache deleted', { key });
      }
      return result > 0;
    } catch (error) {
      logger.error('Redis delete error', { key, error });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.client) return 0;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;

      const result = await this.client.del(...keys);
      logger.debug('Cache pattern deleted', { pattern, count: result });
      return result;
    } catch (error) {
      logger.error('Redis deletePattern error', { pattern, error });
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', { key, error });
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.client) return -2;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Redis ttl error', { key, error });
      return -2;
    }
  }

  /**
   * Clear all cache entries (use with caution)
   */
  async clear(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.flushdb();
      logger.debug('Cache cleared');
    } catch (error) {
      logger.error('Redis clear error', { error });
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: number; keys: string[] }> {
    if (!this.client) return { size: 0, keys: [] };

    try {
      const keys = await this.client.keys('*');
      return { size: keys.length, keys };
    } catch {
      return { size: 0, keys: [] };
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

// Singleton instance
export const cache = new RedisCache();
