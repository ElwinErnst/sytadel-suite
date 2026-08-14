/**
 * Rate limiter for the public demo endpoint.
 *
 * Uses Upstash Redis (a sliding window shared across ALL serverless instances)
 * when `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set. Without
 * them — local dev, preview, or the self-hosted stack — it falls back to a
 * per-instance in-memory window (best-effort). If Upstash is configured but
 * unreachable, it fails OPEN to the in-memory limiter rather than taking the
 * demo down.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const LIMIT = 8; // requests
const WINDOW = '60 s'; // per IP
const WINDOW_MS = 60_000;

// Lazily built once per warm instance. `undefined` = not yet resolved,
// `null` = Upstash not configured (use the in-memory fallback).
let ratelimit: Ratelimit | null | undefined;

function getRatelimit(): Ratelimit | null {
  if (ratelimit !== undefined) return ratelimit;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  ratelimit =
    url && token
      ? new Ratelimit({
          redis: new Redis({ url, token }),
          limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
          prefix: 'demo-ratelimit',
        })
      : null;
  return ratelimit;
}

// Per-instance fallback. Ephemeral and not shared across instances, so only a
// coarse backstop — the real ceiling with Upstash absent is the per-request
// turn/token cap in the agent.
const hits = new Map<string, { count: number; resetAt: number }>();

function memoryLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

/** Returns true if the IP has exceeded its request budget for the window. */
export async function rateLimited(ip: string): Promise<boolean> {
  const rl = getRatelimit();
  if (!rl) return memoryLimited(ip);
  try {
    const { success } = await rl.limit(ip);
    return !success;
  } catch {
    // Upstash unreachable — degrade to the in-memory limiter, don't 500 the demo.
    return memoryLimited(ip);
  }
}
