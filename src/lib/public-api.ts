import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export class PublicApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "PublicApiError";
    this.status = status;
    this.code = code;
  }
}

export function publicApiErrorInfo(error: unknown) {
  if (error instanceof PublicApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      name?: unknown;
      status?: unknown;
      code?: unknown;
      message?: unknown;
    };
    const status = Number(candidate.status);
    if (
      candidate.name === "PublicApiError"
      && Number.isInteger(status)
      && status >= 400
      && status <= 599
      && typeof candidate.code === "string"
      && typeof candidate.message === "string"
    ) {
      return { status, code: candidate.code, message: candidate.message };
    }
  }

  return null;
}

export async function readJsonBody<T>(request: Request, maxBytes = 64_000): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new PublicApiError("Requête JSON requise.", 415, "JSON_REQUIRED");
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new PublicApiError("Requête trop volumineuse.", 413, "BODY_TOO_LARGE");
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    throw new PublicApiError("Requête trop volumineuse.", 413, "BODY_TOO_LARGE");
  }
  if (!raw.trim()) throw new PublicApiError("Corps de requête vide.", 400, "EMPTY_BODY");

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new PublicApiError("JSON invalide.", 400, "INVALID_JSON");
  }
}

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  retryAfter: number;
  limit: number;
};

const warnedScopes = new Set<string>();

function clientFingerprint(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("cf-connecting-ip")?.trim()
    || "unknown";
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 240);
  const secret = process.env.RATE_LIMIT_SECRET?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || "ichigo-rate-limit-fallback";

  return createHash("sha256")
    .update(`${secret}|${scope}|${ip}|${ip === "unknown" ? userAgent : ""}`)
    .digest("hex");
}

export async function consumeRateLimit(
  request: Request,
  supabase: SupabaseClient,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (process.env.RATE_LIMIT_DISABLED === "1" || process.env.RATE_LIMIT_DISABLED === "true") {
    return {
      allowed: true,
      remaining: options.limit,
      resetAt: new Date(Date.now() + options.windowSeconds * 1000).toISOString(),
      retryAfter: 0,
      limit: options.limit,
    };
  }

  const keyHash = clientFingerprint(request, options.scope);
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_scope: options.scope,
    p_key_hash: keyHash,
    p_window_seconds: options.windowSeconds,
    p_limit: options.limit,
  });

  if (error) {
    if (!warnedScopes.has(options.scope)) {
      warnedScopes.add(options.scope);
      console.error(`Rate limiter unavailable for ${options.scope}`, error.message);
    }
    return {
      allowed: true,
      remaining: options.limit,
      resetAt: new Date(Date.now() + options.windowSeconds * 1000).toISOString(),
      retryAfter: 0,
      limit: options.limit,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const resetAt = String(row?.reset_at || new Date(Date.now() + options.windowSeconds * 1000).toISOString());
  const retryAfter = Math.max(1, Math.ceil((new Date(resetAt).getTime() - Date.now()) / 1000));

  return {
    allowed: Boolean(row?.allowed),
    remaining: Math.max(0, Number(row?.remaining ?? 0)),
    resetAt,
    retryAfter,
    limit: options.limit,
  };
}

export function tooManyRequests(result: RateLimitResult, message = "Trop de tentatives. Réessayez dans quelques instants.") {
  return NextResponse.json(
    { error: message, code: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.floor(new Date(result.resetAt).getTime() / 1000)),
      },
    },
  );
}
