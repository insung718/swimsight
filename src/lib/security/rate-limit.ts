import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis/cloudflare";
import { NextResponse, type NextRequest } from "next/server";

type LocalBucket = { count: number; reset: number };

const localBuckets = new Map<string, LocalBucket>();
const redisConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = redisConfigured ? Redis.fromEnv() : null;

const distributedLimiters = redis
  ? {
      ipRead: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(90, "1 m"), prefix: "swimsight:ip:read" }),
      ipWrite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), prefix: "swimsight:ip:write" }),
      userRead: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(180, "1 m"), prefix: "swimsight:user:read" }),
      userWrite: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), prefix: "swimsight:user:write" })
    }
  : null;

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function localLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = localBuckets.get(key);

  if (!current || current.reset <= now) {
    if (localBuckets.size >= 10_000) {
      for (const [bucketKey, bucket] of localBuckets) {
        if (bucket.reset <= now) localBuckets.delete(bucketKey);
      }
      if (localBuckets.size >= 10_000) localBuckets.delete(localBuckets.keys().next().value as string);
    }
    const reset = now + windowMs;
    localBuckets.set(key, { count: 1, reset });
    return { success: true, reset, remaining: limit - 1 };
  }

  current.count += 1;
  return { success: current.count <= limit, reset: current.reset, remaining: Math.max(limit - current.count, 0) };
}

async function consume(kind: "ipRead" | "ipWrite" | "userRead" | "userWrite", identifier: string) {
  const write = kind.endsWith("Write");
  const user = kind.startsWith("user");
  const limit = user ? (write ? 60 : 180) : write ? 30 : 90;
  if (distributedLimiters) {
    try {
      return await distributedLimiters[kind].limit(identifier);
    } catch {
      // Preserve availability while retaining per-instance protection.
    }
  }
  return localLimit(`${kind}:${identifier}`, limit, 60_000);
}

export async function enforceApiRateLimit(request: NextRequest, userId?: string | null) {
  if (!request.nextUrl.pathname.startsWith("/api/")) return null;

  const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const ipResult = await consume(write ? "ipWrite" : "ipRead", clientIp(request));
  const userResult = userId ? await consume(write ? "userWrite" : "userRead", userId) : null;
  const blocked = !ipResult.success || (userResult && !userResult.success);

  if (!blocked) return null;

  const reset = Math.max(ipResult.reset, userResult?.reset ?? 0);
  const retryAfter = Math.max(Math.ceil((reset - Date.now()) / 1000), 1);

  return NextResponse.json(
    { error: "Too many requests. Please wait and try again.", retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } }
  );
}
