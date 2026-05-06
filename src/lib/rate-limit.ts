import { NextRequest, NextResponse } from "next/server";
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from "rate-limiter-flexible";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Reusar conexión Redis de BullMQ — sin deps adicionales de runtime
function makeRedisClient() {
  if (process.env.RATE_LIMIT_DISABLED === "true") return null;
  try {
    const Redis = require("ioredis");
    return new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  } catch {
    return null;
  }
}

const redisClient = makeRedisClient();

type RateLimitConfig = {
  points:   number; // max requests
  duration: number; // window in seconds
  keyPrefix: string;
};

const limiters = new Map<string, RateLimiterAbstract>();

function getLimiter(cfg: RateLimitConfig): RateLimiterAbstract {
  const key = cfg.keyPrefix;
  if (limiters.has(key)) return limiters.get(key)!;

  let limiter: RateLimiterAbstract;
  if (redisClient) {
    limiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: cfg.points,
      duration: cfg.duration,
      keyPrefix: cfg.keyPrefix,
    });
  } else {
    // Fallback in-memory when Redis is not available
    limiter = new RateLimiterMemory({ points: cfg.points, duration: cfg.duration });
  }
  limiters.set(key, limiter);
  return limiter;
}

function getKey(req: NextRequest, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `ip:${ip}`;
}

/**
 * withRateLimit — wraps a route handler with rate limiting.
 *
 * Usage:
 *   export const POST = withRateLimit(
 *     { points: 5, duration: 60, keyPrefix: "rl:register" },
 *     async (req, ctx) => { ... }
 *   );
 */
export function withRateLimit<C>(
  cfg: RateLimitConfig,
  handler: (req: NextRequest, ctx: C) => Promise<NextResponse>,
  getUserId?: (req: NextRequest, ctx: C) => Promise<string | undefined>
) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    if (process.env.RATE_LIMIT_DISABLED === "true") {
      return handler(req, ctx);
    }

    const userId = getUserId ? await getUserId(req, ctx) : undefined;
    const key = getKey(req, userId);
    const limiter = getLimiter(cfg);

    try {
      const res = await limiter.consume(key);
      const response = await handler(req, ctx);
      response.headers.set("X-RateLimit-Remaining", String(res.remainingPoints));
      return response;
    } catch (rejection: any) {
      const secs = Math.ceil((rejection?.msBeforeNext ?? 1000) / 1000);
      return NextResponse.json(
        { error: "TooManyRequests", retryAfter: secs },
        {
          status: 429,
          headers: {
            "Retry-After": String(secs),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + secs),
          },
        }
      );
    }
  };
}

// ─── Pre-configured limiters for critical routes ───────────────────────────

export const registerRateLimit = (
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>
) =>
  withRateLimit(
    { points: 5, duration: 60, keyPrefix: "rl:register" },
    handler
  );

export const uploadRateLimit = (
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>,
  getUserId: (req: NextRequest, ctx: unknown) => Promise<string | undefined>
) =>
  withRateLimit(
    { points: 20, duration: 3600, keyPrefix: "rl:upload" },
    handler,
    getUserId
  );

export const processRateLimit = (
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>,
  getUserId: (req: NextRequest, ctx: unknown) => Promise<string | undefined>
) =>
  withRateLimit(
    { points: 10, duration: 3600, keyPrefix: "rl:process" },
    handler,
    getUserId
  );

export const searchRateLimit = (
  handler: (req: NextRequest, ctx: unknown) => Promise<NextResponse>,
  getUserId: (req: NextRequest, ctx: unknown) => Promise<string | undefined>
) =>
  withRateLimit(
    { points: 60, duration: 60, keyPrefix: "rl:search" },
    handler,
    getUserId
  );
