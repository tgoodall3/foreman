// In-memory rate limiter used in tests and as a utility.
// Production API routes use DB-based rate limiting (count queries) instead.
const store = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(identifier: string, max = 10, windowMs = 10 * 60 * 1000): Promise<{ success: boolean; reset: number }> {
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || now > existing.resetTime) {
    store.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, reset: now + windowMs };
  }

  if (existing.count < max) {
    existing.count++;
    return { success: true, reset: existing.resetTime };
  }

  return { success: false, reset: existing.resetTime };
}
