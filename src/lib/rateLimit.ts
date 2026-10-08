/**
 * Minimal in-process rate limiter (fixed-window token bucket) for /api/analyze.
 *
 * IMPORTANT LIMITATION: this is per-serverless-instance memory. On Vercel the
 * app can run several concurrent instances, so an attacker spread across
 * instances gets `limit × instances` requests. It still stops the common case
 * (a single script hammering one warm instance) and costs nothing. For strict
 * global limits, swap `checkRateLimit` for a distributed store
 * (e.g. `@upstash/ratelimit` + Upstash Redis) — the signature is designed for
 * that: return { allowed, remaining, retryAfterSeconds }.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Requests allowed per window, per key. */
const LIMIT = 10;
/** Window length in milliseconds. */
const WINDOW_MS = 60_000;
/** Hard cap on tracked keys so memory cannot grow unbounded. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, now = Date.now()): RateLimitResult {
  // Opportunistic cleanup of expired buckets.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
    // If still too big after pruning expired, drop oldest to stay bounded.
    if (buckets.size > MAX_KEYS) {
      const excess = buckets.size - MAX_KEYS;
      let i = 0;
      for (const k of buckets.keys()) {
        if (i++ >= excess) break;
        buckets.delete(k);
      }
    }
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: LIMIT - existing.count, retryAfterSeconds: 0 };
}

/** Test helper: clear all buckets. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Best-effort client identifier. Uses the platform-provided forwarding headers;
 * falls back to a constant so the limiter still applies (just globally).
 */
export function clientKey(req: Request): string {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}
