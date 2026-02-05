import { logger } from '../logging/logger';
import { config } from '../../config';

/**
 * Cache Entry with TTL tracking
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-Memory Cache Implementation
 * Implements cache-aside pattern with TTL support
 * Simulates Redis behavior for development/testing
 */
export class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private defaultTtl: number = config.cache.ttl) {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get value from cache
   * Returns null if key doesn't exist or is expired
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTtl;
    const expiresAt = Date.now() + ttl * 1000;
    
    this.cache.set(key, { value, expiresAt });
    logger.debug('Cache set', { key, ttl });
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache deleted', { key });
    }
    return deleted;
  }

  /**
   * Delete all keys matching a pattern (simple prefix match)
   */
  async deletePattern(pattern: string): Promise<number> {
    let count = 0;
    const prefix = pattern.replace('*', '');
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    logger.debug('Cache pattern deleted', { pattern, count });
    return count;
  }

  /**
   * Check if key exists and is not expired
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get remaining TTL for a key in seconds
   */
  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2; // Key doesn't exist
    
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -1; // -1 = expired
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup', { cleaned });
    }
  }

  /**
   * Shutdown cache (clear interval)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new InMemoryCache();
