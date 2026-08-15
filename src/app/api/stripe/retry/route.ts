import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { createOrReuseStripeCheckout, MinimumOnlinePaymentError } from "@/lib/stripe";
import { consumeRateLimit, publicApiErrorInfo, readJsonBody, tooManyRequests } from "@/lib/public-api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
    const rateLimit = await consumeRateLimit(request, supabase, { scope: "stripe:retry", limit: 20, windowSeconds: 600 });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const body = await readJsonBody<{ publicToken?: string }>(request, 8_000);
    const token = String(body.publicToken || "");
    if (!UUID_RE.test(token)) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const { data: order, error } = await supabase.from("orders")
      .select("id,order_number,total,payment_status,status,payment_method")
      .eq("public_token", token)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    if (order.status === "cancelled" || order.status === "refunded") return NextResponse.json({ error: "Cette commande ne peut plus être payée." }, { status: 409 });
    if (order.payment_status === "paid") return NextResponse.json({ paid: true, trackingUrl: `/commande/${token}` });

    const session = await createOrReuseStripeCheckout(supabase, order.id, new URL(request.url).origin);
    return NextResponse.json({
      paid: session.alreadyPaid,
      clientSecret: session.clientSecret,
      sessionId: session.sessionId,
      trackingUrl: session.trackingUrl,
      orderNumber: order.order_number,
      total: Number(order.total || 0),
    });
  } catch (error) {
    console.error(error);
    if (error instanceof MinimumOnlinePaymentError) {
      return NextResponse.json(
        { error: "Le montant minimum pour un paiement en ligne est de 1,00 €.", code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    const publicError = publicApiErrorInfo(error);
    if (publicError) {
      return NextResponse.json(
        { error: publicError.message, code: publicError.code },
        { status: publicError.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de relancer le paiement." }, { status: 500 });
  }
}
