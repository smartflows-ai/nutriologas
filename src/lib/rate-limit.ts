// src/lib/rate-limit.ts
// Best-effort per-IP limiter for public endpoints. Memory is per server instance, so it only
// slows down abuse; it is not a hard guarantee.
const hits = new Map<string, number[]>();

// Window used by the routes that guard a credential (password change, team writes).
export const AUTH_ATTEMPTS_WINDOW_MS = 15 * 60 * 1000;

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    hits.forEach((times, k) => {
      if (times.every((t) => now - t >= windowMs)) hits.delete(k);
    });
  }
  return recent.length > max;
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
