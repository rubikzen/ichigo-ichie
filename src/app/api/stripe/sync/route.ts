import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { getStripeServer, markStripeOrderPaid, markStripeOrderUnpaid } from "@/lib/stripe";
import { consumeRateLimit, publicApiErrorInfo, readJsonBody, tooManyRequests } from "@/lib/public-api";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHECKOUT_SESSION_RE = /^cs_(?:test|live)_[A-Za-z0-9]+$/;

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    const stripe = getStripeServer();
    if (!supabase || !stripe) {
      return NextResponse.json(
        { error: "Synchronisation Stripe indisponible." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "stripe:return-sync",
      limit: 40,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const body = await readJsonBody<{ publicToken?: string; sessionId?: string }>(
      request,
      8_000,
    );
    const publicToken = String(body.publicToken || "").trim();
    const requestedSessionId = String(body.sessionId || "").trim();

    if (!UUID_RE.test(publicToken)) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (requestedSessionId && !CHECKOUT_SESSION_RE.test(requestedSessionId)) {
      return NextResponse.json(
        { error: "Session de paiement invalide." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,payment_method,stripe_checkout_session_id",
      )
      .eq("public_token", publicToken)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) {
      return NextResponse.json(
        { error: "Commande introuvable." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (
      order.status === "refunded" ||
      order.payment_status === "refunded" ||
      order.payment_status === "refund_pending"
    ) {
      return NextResponse.json(
        {
          ok: true,
          changed: false,
          paid: order.payment_status === "refunded",
          paymentStatus: order.payment_status,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (order.payment_status === "paid") {
      return NextResponse.json(
        { ok: true, changed: false, paid: true, paymentStatus: "paid" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (order.payment_method !== "online") {
      return NextResponse.json(
        { ok: true, changed: false, paid: false, paymentStatus: order.payment_status },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const sessionId =
      requestedSessionId || String(order.stripe_checkout_session_id || "").trim();

    if (!sessionId || !CHECKOUT_SESSION_RE.test(sessionId)) {
      return NextResponse.json(
        { ok: true, changed: false, paid: false, paymentStatus: order.payment_status },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      session.metadata?.order_id !== order.id ||
      (session.metadata?.order_number &&
        session.metadata.order_number !== order.order_number)
    ) {
      return NextResponse.json(
        { error: "Session de paiement incompatible avec cette commande." },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (session.payment_status === "paid") {
      await markStripeOrderPaid(supabase, session);
      return NextResponse.json(
        {
          ok: true,
          changed: true,
          paid: true,
          paymentStatus: "paid",
          sessionStatus: session.status,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (
      session.status === "expired" &&
      session.id === order.stripe_checkout_session_id
    ) {
      await markStripeOrderUnpaid(supabase, session, "expired");
      return NextResponse.json(
        {
          ok: true,
          changed: true,
          paid: false,
          paymentStatus: "expired",
          sessionStatus: session.status,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        changed: false,
        paid: false,
        paymentStatus: order.payment_status,
        sessionStatus: session.status,
        stripePaymentStatus: session.payment_status,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Stripe return reconciliation error", error);
    const publicError = publicApiErrorInfo(error);
    if (publicError) {
      return NextResponse.json(
        { error: publicError.message, code: publicError.code },
        { status: publicError.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Impossible de synchroniser le paiement pour le moment." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
