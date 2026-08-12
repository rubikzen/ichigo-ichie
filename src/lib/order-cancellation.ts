import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeServer, markStripeOrderPaid } from "@/lib/stripe";
import { sendOrderEmail } from "@/lib/order-email";

type CancellationActor = "customer" | "admin";

export type OrderCancellationResult =
  | {
      ok: true;
      status: "cancelled";
      paymentStatus: string;
      cancelledNow: boolean;
    }
  | {
      ok: false;
      httpStatus: number;
      error: string;
      cancelled: boolean;
    };

function blocked(error: string, httpStatus = 409): OrderCancellationResult {
  return { ok: false, httpStatus, error, cancelled: false };
}

export async function cancelUnpaidOrder(
  supabase: SupabaseClient,
  orderId: string,
  options: { actor?: CancellationActor } = {},
): Promise<OrderCancellationResult> {
  const actor = options.actor ?? "customer";
  const logPrefix = actor === "admin" ? "Admin order cancel" : "Customer order cancel";

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,payment_status,payment_method,stripe_checkout_session_id,stock_reserved,promo_reserved",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  if (!order) return blocked("Commande introuvable.", 404);

  if (
    ["paid", "refunded", "refund_pending", "refund_failed"].includes(
      String(order.payment_status || ""),
    ) ||
    order.status === "refunded"
  ) {
    return blocked(
      "Cette commande a déjà été payée ou remboursée et ne peut plus être simplement annulée.",
    );
  }

  if (["preparing", "ready", "completed"].includes(order.status)) {
    return blocked(
      "Cette commande est déjà en préparation et ne peut plus être annulée.",
    );
  }

  if (order.stripe_checkout_session_id) {
    const stripe = getStripeServer();
    if (!stripe) {
      return blocked(
        "Le service de paiement est momentanément indisponible.",
        503,
      );
    }

    try {
      const session = await stripe.checkout.sessions.retrieve(
        order.stripe_checkout_session_id,
      );

      if (session.status === "complete") {
        if (session.payment_status === "paid") {
          await markStripeOrderPaid(supabase, session);
          return blocked(
            "Le paiement vient d’être confirmé. La commande ne peut plus être annulée.",
          );
        }

        return blocked(
          "La session de paiement est déjà finalisée et son résultat doit être vérifié avant annulation.",
        );
      }

      if (session.status === "open") {
        await stripe.checkout.sessions.expire(session.id);
      }
    } catch (stripeError) {
      console.error(`${logPrefix} Stripe error`, stripeError);
      return blocked(
        "Impossible de sécuriser l’annulation du paiement. Réessayez dans un instant.",
        502,
      );
    }
  }

  let cancelledNow = false;
  const nextPaymentStatus =
    order.payment_method === "online" ? "expired" : order.payment_status;

  if (order.status !== "cancelled") {
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
        latest &&
        ["paid", "refunded", "refund_pending", "refund_failed"].includes(
          String(latest.payment_status || ""),
        )
      ) {
        return blocked(
          "Le paiement vient d’être confirmé ou nécessite un remboursement. La commande ne peut plus être annulée.",
        );
      }

      if (latest?.status !== "cancelled") {
        return blocked(
          "La commande a changé d’état. Actualisez la page avant de réessayer.",
        );
      }
    }
  }

  const { data: latestReservationState, error: reservationStateError } =
    await supabase
      .from("orders")
      .select("status,stock_reserved,promo_reserved,payment_status")
      .eq("id", order.id)
      .single();

  if (reservationStateError) throw reservationStateError;

  if (
    ["paid", "refunded", "refund_pending", "refund_failed"].includes(
      String(latestReservationState.payment_status || ""),
    )
  ) {
    return {
      ok: false,
      httpStatus: 409,
      error:
        "Le paiement vient d’être confirmé ou nécessite un remboursement. Vérification manuelle requise.",
      cancelled: latestReservationState.status === "cancelled",
    };
  }

  if (latestReservationState.stock_reserved) {
    const { error: stockError } = await supabase.rpc(
      "release_shop_order_stock",
      { p_order_id: order.id },
    );

    if (stockError) {
      console.error(`${logPrefix} stock release error`, stockError);
      return {
        ok: false,
        httpStatus: 503,
        error:
          "Commande annulée, mais la libération du stock doit être réessayée.",
        cancelled: true,
      };
    }
  }

  if (latestReservationState.promo_reserved) {
    const { error: promoError } = await supabase.rpc("release_order_promo", {
      p_order_id: order.id,
    });

    if (promoError) {
      console.error(`${logPrefix} promo release error`, promoError);
      return {
        ok: false,
        httpStatus: 503,
        error:
          "Commande annulée, mais la libération du code promo doit être réessayée.",
        cancelled: true,
      };
    }
  }

  if (cancelledNow) {
    try {
      await sendOrderEmail(supabase, order.id, "cancellation");
    } catch (emailError) {
      console.error(`${logPrefix} customer email error`, emailError);
    }
  }

  return {
    ok: true,
    status: "cancelled",
    paymentStatus: String(nextPaymentStatus || ""),
    cancelledNow,
  };
}
