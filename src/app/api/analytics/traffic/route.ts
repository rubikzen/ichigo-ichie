import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/public-api";
import { createServiceSupabase } from "@/lib/supabase/admin";

function cleanSessionId(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed.startsWith("traffic-") || trimmed.length > 80) return "";
  return /^[A-Za-z0-9:_-]+$/.test(trimmed) ? trimmed : "";
}

function cleanPath(value: unknown) {
  if (typeof value !== "string") return "/";
  const path = value.split(/[?#]/, 1)[0]?.trim() || "/";
  if (!path.startsWith("/")) return "/";
  return path.slice(0, 180);
}

function shouldIgnorePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function isLikelyBot(request: Request) {
  const userAgent = request.headers.get("user-agent") || "";
  return /bot|crawler|spider|slurp|headless|lighthouse|pagespeed/i.test(
    userAgent,
  );
}

function requestCountry(request: Request) {
  const value = (request.headers.get("x-vercel-ip-country") || "")
    .trim()
    .toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : "";
}

function requestCity(request: Request) {
  const raw = (request.headers.get("x-vercel-ip-city") || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  } catch {
    return raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 2_048) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let input: Record<string, unknown>;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sessionId = cleanSessionId(input.session_id);
  const path = cleanPath(input.path);
  if (!sessionId || shouldIgnorePath(path)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const vercelEnvironment = process.env.VERCEL_ENV;
  if (
    process.env.E2E_LOCAL === "1" ||
    process.env.NODE_ENV !== "production" ||
    (vercelEnvironment && vercelEnvironment !== "production") ||
    isLikelyBot(request)
  ) {
    return NextResponse.json(
      { ok: true },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { ok: true },
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "analytics:traffic:v4893",
      limit: 180,
      windowSeconds: 600,
    });

    if (rateLimit.allowed) {
      const country = requestCountry(request);
      const city = requestCity(request);
      const { error } = await supabase.from("conversion_events").insert({
        event: "product_view",
        session_id: sessionId,
        occurred_at: new Date().toISOString(),
        path,
        product_id: null,
        // Traffic sentinel rows reuse fields that are otherwise unused when product_id is null.
        // No IP, user-agent or customer identity is persisted.
        variant_id: country ? `geo:${country}` : null,
        transaction_ref: city || null,
      });

      if (error) {
        console.warn("[traffic:v4893] persistence unavailable", error.message);
      }
    }
  } catch (error) {
    console.warn(
      "[traffic:v4893] persistence failed",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 202, headers: { "cache-control": "no-store" } },
  );
}
