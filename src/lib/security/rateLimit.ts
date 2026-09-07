/**
 * Simple in-memory rate limiter for serverless-ish Node runtimes.
 * Best-effort protection against accidental hammering of our API
 * (and thus Guelph upstream). Not a substitute for edge WAF.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

const MAX_ENTRIES = 5_000;

export function rateLimit(options: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  if (buckets.size > MAX_ENTRIES) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(options.key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(options.key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return {
      ok: true,
      remaining: options.limit - 1,
      retryAfterSec: Math.ceil(options.windowMs / 1000),
    };
  }

  existing.count += 1;
  const retryAfterSec = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000),
  );
  if (existing.count > options.limit) {
    return { ok: false, remaining: 0, retryAfterSec };
  }
  return {
    ok: true,
    remaining: Math.max(0, options.limit - existing.count),
    retryAfterSec,
  };
}

export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
