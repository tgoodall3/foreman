import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Check if Redis is configured
const hasRedisConfig = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
let rateLimiter: Ratelimit | null = null;

if (hasRedisConfig) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  // Rate limiter: 10 requests per 10 minutes per IP
  rateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    analytics: true,
  });
}

// In-memory fallback for development/testing
const inMemoryStore = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(identifier: string): Promise<{ success: boolean; reset?: number }> {
  if (rateLimiter) {
    // Use Redis rate limiter in production
    const result = await rateLimiter.limit(identifier);
    return {
      success: result.success,
      reset: result.reset,
    };
  } else {
    // Fallback to in-memory rate limiting for dev/test
    const now = Date.now();
    const windowMs = 10 * 60 * 1000; // 10 minutes
    const maxRequests = 10;

    const existing = inMemoryStore.get(identifier);
    if (!existing || now > existing.resetTime) {
      // First request or window expired
      inMemoryStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs,
      });
      return { success: true, reset: now + windowMs };
    } else if (existing.count < maxRequests) {
      // Within limit
      existing.count++;
      return { success: true, reset: existing.resetTime };
    } else {
      // Rate limited
      return { success: false, reset: existing.resetTime };
    }
  }
}
