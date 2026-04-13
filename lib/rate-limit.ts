import { NextRequest } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store — resets on process restart. Good enough for self-hosted/long-running.
// For Vercel serverless, each cold start gets a fresh store, providing light protection.
const store = new Map<string, RateLimitEntry>();

// Clean up old entries periodically to prevent memory growth
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key       Unique key (e.g. IP address or "ip:email")
 * @param limit     Max requests allowed in the window
 * @param windowMs  Window duration in milliseconds (default 15 min)
 */
export function checkRateLimit(key: string, limit: number, windowMs = 15 * 60 * 1000): boolean {
  cleanup();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
