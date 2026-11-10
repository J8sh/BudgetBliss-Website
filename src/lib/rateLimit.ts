/**
 * Simple in-memory rate limiter for single-user self-hosted deployments.
 * Limits a given key to `maxRequests` within `windowMs`.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  key: string;
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit({ key, maxRequests, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

/**
 * Failure counter for login-style checks: only failed attempts count, and a success clears it.
 * Once a key reaches `maxFailures` within `windowMs`, it stays blocked until the window ends.
 */
const failureStore = new Map<string, RateLimitEntry>();
const MAX_TRACKED_KEYS = 10_000;

export interface ThrottleResult {
  blocked: boolean;
  retryAfterMs: number;
}

export function checkFailureThrottle(key: string, maxFailures: number): ThrottleResult {
  const now = Date.now();
  const entry = failureStore.get(key);
  if (!entry || now > entry.resetAt) {
    return { blocked: false, retryAfterMs: 0 };
  }
  return entry.count >= maxFailures
    ? { blocked: true, retryAfterMs: entry.resetAt - now }
    : { blocked: false, retryAfterMs: 0 };
}

export function recordFailure(key: string, windowMs: number): void {
  const now = Date.now();

  // Keep memory bounded if many different IPs are failing
  if (failureStore.size >= MAX_TRACKED_KEYS) {
    for (const [k, v] of failureStore) {
      if (now > v.resetAt) failureStore.delete(k);
    }
  }

  const entry = failureStore.get(key);
  if (!entry || now > entry.resetAt) {
    failureStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count++;
}

export function clearFailures(key: string): void {
  failureStore.delete(key);
}

/** Test helper — resets all failure counters */
export function resetFailureThrottles(): void {
  failureStore.clear();
}
