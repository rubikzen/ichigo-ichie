import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  PublicApiError,
  publicApiErrorInfo,
  readJsonBody,
  tooManyRequests,
} from "@/lib/public-api";
import { verifyRestockManageToken } from "@/lib/restock-subscription";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 4_000);
    const subscriptionId = clean(body.subscriptionId, 64);
    const token = clean(body.token, 128);

    if (!UUID_RE.test(subscriptionId) || !verifyRestockManageToken(subscriptionId, token)) {
      throw new PublicApiError("Lien d’alerte invalide.", 400, "RESTOCK_UNSUBSCRIBE_INVALID");
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Service indisponible.",
          code: "RESTOCK_UNSUBSCRIBE_SERVICE_UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "restock:unsubscribe",
      limit: 12,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) {
      return tooManyRequests(
        rateLimit,
        "Trop de demandes. Réessayez dans quelques instants.",
      );
    }

    const { data: subscription, error: loadError } = await supabase
      .from("restock_subscriptions")
      .select("id,status")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (loadError) throw loadError;
    if (!subscription) {
      throw new PublicApiError("Alerte introuvable.", 404, "RESTOCK_UNSUBSCRIBE_NOT_FOUND");
    }

    if (subscription.status === "cancelled") {
      return NextResponse.json({ ok: true, state: "cancelled", alreadyCancelled: true });
    }
    if (subscription.status === "notified") {
      return NextResponse.json({ ok: true, state: "notified", alreadyInactive: true });
    }

    const cancelledAt = new Date().toISOString();
    const { data: cancelled, error: cancelError } = await supabase
      .from("restock_subscriptions")
      .update({ status: "cancelled", cancelled_at: cancelledAt })
      .eq("id", subscriptionId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (cancelError) throw cancelError;
    if (!cancelled) {
      return NextResponse.json({ ok: true, state: "inactive", alreadyInactive: true });
    }

    return NextResponse.json({ ok: true, state: "cancelled", cancelledAt });
  } catch (error) {
    console.error("Restock unsubscribe error", error);
    const publicError = publicApiErrorInfo(error);
    if (publicError) {
      return NextResponse.json(
        { error: publicError.message, code: publicError.code },
        { status: publicError.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Impossible de modifier cette alerte pour le moment.", code: "RESTOCK_UNSUBSCRIBE_FAILED" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
