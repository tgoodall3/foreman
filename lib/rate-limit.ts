import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory fallback (used only if Supabase is unavailable)
const store = new Map<string, RateLimitEntry>();
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
 * Shared rate limiter backed by Supabase (public.rate_limits).
 * Falls back to in-memory if the DB call fails or the service key is missing.
 * Returns true if allowed, false if limited.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 15 * 60 * 1000
): Promise<boolean> {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createServiceClient();
      const now = new Date();
      const windowEnd = new Date(now.getTime() + windowMs);

      const { data: existing } = await supabase
        .from("rate_limits")
        .select("count, window_end")
        .eq("key", key)
        .maybeSingle();

      if (!existing || !existing.window_end || new Date(existing.window_end).getTime() < now.getTime()) {
        await supabase
          .from("rate_limits")
          .upsert({ key, count: 1, window_end: windowEnd, updated_at: now });
        return true;
      }

      if (existing.count >= limit) return false;

      await supabase
        .from("rate_limits")
        .update({ count: existing.count + 1, updated_at: now })
        .eq("key", key);
      return true;
    } catch {
      // fall back below
    }
  }

  // In-memory fallback
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