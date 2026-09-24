/**
 * Tiny in-memory fixed-window rate limiter (per Autoscale instance; good enough to
 * stop floods and scripted abuse). Bounded: stale buckets are swept as it grows.
 */
export type RateLimitRule = { max: number; windowMs: number };
export type RateLimitResult = { limited: boolean; retryAfterSec: number };

const MAX_BUCKETS = 20_000;

export class FixedWindowLimiter {
  private buckets = new Map<string, { count: number; startedAt: number }>();

  constructor(private readonly rule: RateLimitRule) {}

  hit(key: string, now: number = Date.now()): RateLimitResult {
    const b = this.buckets.get(key);
    if (!b || now - b.startedAt >= this.rule.windowMs) {
      if (this.buckets.size >= MAX_BUCKETS) this.sweep(now);
      this.buckets.set(key, { count: 1, startedAt: now });
      return { limited: false, retryAfterSec: 0 };
    }
    b.count += 1;
    const limited = b.count > this.rule.max;
    return { limited, retryAfterSec: limited ? Math.max(1, Math.ceil((b.startedAt + this.rule.windowMs - now) / 1000)) : 0 };
  }

  reset(): void {
    this.buckets.clear();
  }

  private sweep(now: number): void {
    for (const [k, v] of this.buckets) if (now - v.startedAt >= this.rule.windowMs) this.buckets.delete(k);
    // Still full (a real flood): drop the oldest half rather than grow without bound.
    if (this.buckets.size >= MAX_BUCKETS) {
      let n = 0;
      for (const k of this.buckets.keys()) {
        if (n++ > MAX_BUCKETS / 2) break;
        this.buckets.delete(k);
      }
    }
  }
}

/** Sensible public limits (Randy 6:50pm). */
export const LIMITS = {
  chatPerSession: { max: 20, windowMs: 60_000 },
  chatPerIp: { max: 60, windowMs: 10 * 60_000 },
  chatEventPerIp: { max: 120, windowMs: 10 * 60_000 },
  voicePerSession: { max: 6, windowMs: 10 * 60_000 },
  voicePerIp: { max: 10, windowMs: 10 * 60_000 },
  humanVerifyPerIp: { max: 20, windowMs: 10 * 60_000 },
  formPerIp: { max: 20, windowMs: 10 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export const FRIENDLY_429 =
  "Whoa, that's a lot of messages at once. Give it a minute and try again, or use the Call button to reach Randy's team.";

const registry: FixedWindowLimiter[] = [];
export function limiter(rule: RateLimitRule): FixedWindowLimiter {
  const l = new FixedWindowLimiter(rule);
  registry.push(l);
  return l;
}
export function resetRateLimitsForTests(): void {
  for (const l of registry) l.reset();
}
