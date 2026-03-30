import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Edge runtime safe client (HTTP + fetch). Only enabled when env vars are present.
const redis =
  redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

function getIp(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  // `req.ip` is not typed/stable across runtimes; rely on forwarding headers.
  return "unknown";
}

function rateLimitOrPass(
  req: NextRequest,
  limit: Ratelimit
): Promise<NextResponse | null> {
  return (async () => {
    if (!redis) return null; // If not configured, don't block.
    const ip = getIp(req);
    const { success, limit: max, remaining, reset } = await limit.limit(ip);
    if (success) return null;

    const res = NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429 }
    );
    res.headers.set("Retry-After", String(Math.ceil(reset / 1000)));
    res.headers.set("X-RateLimit-Limit", String(max));
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
  })();
}

const chatLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "ard:rl:chat",
    })
  : null;

const readLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, "1 m"),
      analytics: true,
      prefix: "ard:rl:read",
    })
  : null;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Basic bot throttling: very aggressive crawlers get limited faster.
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isLikelyBot =
    ua.includes("bot") || ua.includes("crawler") || ua.includes("spider");

  if (redis && isLikelyBot && readLimiter) {
    const botLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "1 m"),
      analytics: true,
      prefix: "ard:rl:bot",
    });
    const blocked = await rateLimitOrPass(req, botLimiter);
    if (blocked) return blocked;
  }

  // Rate limit specific surfaces.
  if (pathname.startsWith("/api/chat")) {
    if (chatLimiter) {
      const blocked = await rateLimitOrPass(req, chatLimiter);
      if (blocked) return blocked;
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/conversations") ||
    pathname.startsWith("/api/share") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/api/migrate") ||
    pathname.startsWith("/auth")
  ) {
    if (readLimiter) {
      const blocked = await rateLimitOrPass(req, readLimiter);
      if (blocked) return blocked;
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/chat/:path*",
    "/api/conversations/:path*",
    "/api/share/:path*",
    "/api/export",
    "/api/migrate/:path*",
    "/auth",
  ],
};

