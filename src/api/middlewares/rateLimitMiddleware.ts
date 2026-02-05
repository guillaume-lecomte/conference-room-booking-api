import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';
import { logger } from '../../infrastructure/logging/logger';

/**
 * Rate Limit Entry
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Rate Limiter using Sliding Window Algorithm
 * In-memory implementation (simulates Redis)
 */
class RateLimiter {
  private windows: Map<string, RateLimitEntry[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), windowMs);
  }

  /**
   * Check if request should be allowed
   * Returns remaining requests and reset time
   */
  check(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create entries for this key
    let entries = this.windows.get(key) || [];

    // Filter to only include requests within current window
    entries = entries.filter(entry => entry.windowStart > windowStart);

    // Calculate total count in window
    const count = entries.reduce((sum, entry) => sum + entry.count, 0);
    const remaining = Math.max(0, this.maxRequests - count);
    const allowed = count < this.maxRequests;

    if (allowed) {
      // Add new entry
      entries.push({ count: 1, windowStart: now });
      this.windows.set(key, entries);
    }

    // Calculate reset time (when oldest entry expires)
    const oldestEntry = entries[0];
    const resetTime = oldestEntry 
      ? oldestEntry.windowStart + this.windowMs 
      : now + this.windowMs;

    return { allowed, remaining, resetTime };
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, entries] of this.windows.entries()) {
      const filtered = entries.filter(e => e.windowStart > cutoff);
      if (filtered.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, filtered);
      }
    }
  }
}

// Singleton rate limiter
const rateLimiter = new RateLimiter(
  config.rateLimit.windowMs,
  config.rateLimit.maxRequests
);

/**
 * Rate Limiting Middleware
 * Uses sliding window algorithm for accurate rate limiting
 */
export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  // Use IP or user ID as key
  const key = req.ip || 'anonymous';
  const { allowed, remaining, resetTime } = rateLimiter.check(key);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.rateLimit.maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

  if (!allowed) {
    logger.warn('Rate limit exceeded', { key, remaining });
    res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    });
    return;
  }

  next();
}
