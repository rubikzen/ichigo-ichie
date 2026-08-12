import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { getStripeServer, markStripeOrderPaid } from "@/lib/stripe";
import { consumeRateLimit, tooManyRequests } from "@/lib/public-api";
import { sendOrderEmail } from "@/lib/order-email";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!UUID_RE.test(token)) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "orders:cancel",
      limit: 10,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id,order_number,status,payment_status,payment_method,stripe_checkout_session_id,stock_reserved,promo_reserved",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    if (
      order.payment_status === "paid" ||
      order.payment_status === "refunded" ||
      order.payment_status === "refund_pending" ||
      order.status === "refunded"
    ) {
      return NextResponse.json(
        { error: "Cette commande a déjà été payée et ne peut plus être annulée ici." },
        { status: 409 },
      );
    }

    if (["preparing", "ready", "completed"].includes(order.status)) {
      return NextResponse.json(
        { error: "Cette commande est déjà en préparation et ne peut plus être annulée en ligne." },
        { status: 409 },
      );
    }

    if (order.stripe_checkout_session_id) {
      const stripe = getStripeServer();
      if (!stripe) {
        return NextResponse.json(
          { error: "Le service de paiement est momentanément indisponible." },
          { status: 503 },
        );
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_checkout_session_id,
        );

        if (session.status === "complete" && session.payment_status === "paid") {
          await markStripeOrderPaid(supabase, session);
          return NextResponse.json(
            { error: "Le paiement vient d’être confirmé. La commande ne peut plus être annulée." },
            { status: 409 },
          );
        }

        if (session.status === "open") {
          await stripe.checkout.sessions.expire(session.id);
        }
      } catch (stripeError) {
        console.error("Customer order cancel Stripe error", stripeError);
        return NextResponse.json(
          { error: "Impossible de sécuriser l’annulation du paiement. Réessayez dans un instant." },
          { status: 502 },
        );
      }
    }

    // Keep track of whether THIS request performed the cancellation.
    // Retry requests used only to finish reservation cleanup must not send
    // duplicate cancellation messages.
    let cancelledNow = false;

    // Final database transition is conditional. If Stripe/webhook marks the
    // order paid between our Stripe check and this update, zero rows are
    // updated and we MUST NOT release stock/promo.
    if (order.status !== "cancelled") {
      const nextPaymentStatus =
        order.payment_method === "online" ? "expired" : order.payment_status;

      const { data: cancelledOrder, error: cancelError } = await supabase
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: nextPaymentStatus,
          payment_expires_at: null,
        })
        .eq("id", order.id)
        .eq("status", "pending")
        .in("payment_status", ["pending", "unpaid", "failed", "expired"])
        .select("id,status,payment_status")
        .maybeSingle();

      if (cancelError) throw cancelError;
      cancelledNow = Boolean(cancelledOrder);

      if (!cancelledOrder) {
        const { data: latest, error: latestError } = await supabase
          .from("orders")
          .select("status,payment_status")
          .eq("id", order.id)
          .maybeSingle();

        if (latestError) throw latestError;

        if (
          latest?.payment_status === "paid" ||
          latest?.payment_status === "refunded" ||
          latest?.payment_status === "refund_pending"
        ) {
          return NextResponse.json(
            { error: "Le paiement vient d’être confirmé. La commande ne peut plus être annulée." },
            { status: 409 },
          );
        }

        if (latest?.status !== "cancelled") {
          return NextResponse.json(
            { error: "La commande a changé d’état. Actualisez la page avant de réessayer." },
            { status: 409 },
          );
        }
      }
    }

    // Reservation cleanup is retryable. If one RPC fails, return an error
    // instead of pretending cancellation cleanup succeeded.
    const { data: latestReservationState, error: reservationStateError } =
      await supabase
        .from("orders")
        .select("stock_reserved,promo_reserved,payment_status")
        .eq("id", order.id)
        .single();

    if (reservationStateError) throw reservationStateError;

    if (latestReservationState.payment_status === "paid") {
      return NextResponse.json(
        { error: "Le paiement vient d’être confirmé. Vérification manuelle requise." },
        { status: 409 },
      );
    }

    if (latestReservationState.stock_reserved) {
      const { error: stockError } = await supabase.rpc("release_shop_order_stock", {
        p_order_id: order.id,
      });
      if (stockError) {
        console.error("Customer order cancel stock release error", stockError);
        return NextResponse.json(
          { error: "Commande annulée, mais la libération du stock doit être réessayée." },
          { status: 503 },
        );
      }
    }

    if (latestReservationState.promo_reserved) {
      const { error: promoError } = await supabase.rpc("release_order_promo", {
        p_order_id: order.id,
      });
      if (promoError) {
        console.error("Customer order cancel promo release error", promoError);
        return NextResponse.json(
          { error: "Commande annulée, mais la libération du code promo doit être réessayée." },
          { status: 503 },
        );
      }
    }

    // Only an explicit customer cancellation sends this email.
    // Natural Stripe expiry/failed-payment events remain silent.
    if (cancelledNow) {
      try {
        await sendOrderEmail(supabase, order.id, "cancellation");
      } catch (emailError) {
        // The order remains cancelled even if email delivery is temporarily unavailable.
        console.error("Customer cancellation email error", emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      status: "cancelled",
      paymentStatus:
        order.payment_method === "online" ? "expired" : order.payment_status,
    });
  } catch (error) {
    console.error("Customer order cancel error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Annulation impossible." },
      { status: 500 },
    );
  }
}
