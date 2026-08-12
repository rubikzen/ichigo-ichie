import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCommerceEnvironment } from "@/lib/runtime-environment";
import { getStripeServer, markStripeOrderPaid } from "@/lib/stripe";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACTIONS = new Set([
  "release_order_reservations",
  "commit_paid_promo",
  "sync_promo_counter",
]);

const PROCESSED_PAYMENT_STATES = new Set([
  "paid",
  "refunded",
  "refund_pending",
  "refund_failed",
]);

const UNPAID_RECOVERY_STATES = new Set([
  "pending",
  "unpaid",
  "failed",
  "expired",
]);

const PROTECTED_FULFILMENT_STATES = new Set([
  "preparing",
  "ready",
  "completed",
  "refunded",
]);

const STALE_WITHOUT_EXPIRY_MS = 45 * 60 * 1000;
const EXPIRY_GRACE_MS = 5 * 60 * 1000;

function clean(value: unknown, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function timestamp(value: unknown) {
  const parsed = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function processedPayment(value: unknown) {
  return PROCESSED_PAYMENT_STATES.has(String(value || ""));
}

function orderIsRecoverable(order: any, now = Date.now()) {
  if (order.status === "cancelled") return true;
  if (order.payment_status === "failed" || order.payment_status === "expired") {
    return true;
  }

  if (
    order.payment_method !== "online" ||
    !["pending", "unpaid"].includes(String(order.payment_status || ""))
  ) {
    return false;
  }

  const expiresAt = timestamp(order.payment_expires_at);
  if (expiresAt !== null) return expiresAt < now - EXPIRY_GRACE_MS;

  const createdAt = timestamp(order.created_at);
  return createdAt !== null && createdAt < now - STALE_WITHOUT_EXPIRY_MS;
}

function jsonError(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

async function loadOrder(supabase: any, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,payment_status,payment_method,created_at,payment_expires_at,stripe_checkout_session_id,stock_reserved,promo_reserved,promo_code_id,promo_redeemed_at,environment,archived_at",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = clean(body.action, 40);

    if (!ACTIONS.has(action)) {
      return jsonError("Action de récupération invalide.", 400);
    }

    if (action === "sync_promo_counter") {
      const promoId = clean(body.promoId, 60);
      const confirmation = clean(body.confirmation, 40).toUpperCase();

      if (!UUID_RE.test(promoId)) {
        return jsonError("Code promo invalide.", 400);
      }
      if (confirmation !== "SYNC PROMO") {
        return jsonError("Confirmation « SYNC PROMO » requise.", 400);
      }

      const { data: promo, error: promoError } = await supabase
        .from("promo_codes")
        .select("id,code,reserved_count,used_count,usage_limit")
        .eq("id", promoId)
        .maybeSingle();

      if (promoError) throw promoError;
      if (!promo) return jsonError("Code promo introuvable.", 404);

      const { count, error: countError } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("promo_code_id", promoId)
        .eq("promo_reserved", true);

      if (countError) throw countError;

      const actualReserved = count || 0;
      const currentReserved = Number(promo.reserved_count || 0);
      const usedCount = Number(promo.used_count || 0);
      const usageLimit =
        promo.usage_limit == null ? null : Number(promo.usage_limit);

      if (
        usageLimit !== null &&
        Number.isFinite(usageLimit) &&
        usedCount + actualReserved > usageLimit
      ) {
        return jsonError(
          "Les réservations réelles dépassent la limite du code promo. Vérification manuelle requise.",
          409,
        );
      }

      if (actualReserved === currentReserved) {
        return NextResponse.json({
          ok: true,
          changed: false,
          message: `Code ${promo.code} déjà cohérent ✓`,
        });
      }

      const { error: updateError } = await supabase
        .from("promo_codes")
        .update({ reserved_count: actualReserved })
        .eq("id", promoId);

      if (updateError) throw updateError;

      return NextResponse.json({
        ok: true,
        changed: true,
        message: `Compteur ${promo.code} synchronisé : ${currentReserved} → ${actualReserved} ✓`,
      });
    }

    const orderId = clean(body.orderId, 60);
    const confirmation = clean(body.confirmation, 40).toUpperCase();

    if (!UUID_RE.test(orderId)) {
      return jsonError("Commande invalide.", 400);
    }

    const environment = getCommerceEnvironment();
    const order = await loadOrder(supabase, orderId);

    if (!order) return jsonError("Commande introuvable.", 404);
    if (order.archived_at || order.environment !== environment) {
      return jsonError(
        "Cette commande n’appartient pas à l’environnement actif.",
        409,
      );
    }

    if (action === "commit_paid_promo") {
      if (confirmation !== "FINALISER PROMO") {
        return jsonError("Confirmation « FINALISER PROMO » requise.", 400);
      }
      if (!processedPayment(order.payment_status)) {
        return jsonError(
          "Le paiement n’est pas confirmé : le code promo ne doit pas être consommé.",
          409,
        );
      }
      if (!order.promo_code_id) {
        return jsonError("Aucun code promo associé à cette commande.", 409);
      }
      if (!order.promo_reserved) {
        return NextResponse.json({
          ok: true,
          changed: false,
          message: "Réservation promo déjà finalisée ✓",
        });
      }

      const { error: commitError } = await supabase.rpc("commit_order_promo", {
        p_order_id: order.id,
      });

      if (commitError) throw commitError;

      const latest = await loadOrder(supabase, order.id);
      if (latest?.promo_reserved) {
        return jsonError(
          "La réservation promo est toujours active après la tentative de finalisation.",
          503,
          { changed: false },
        );
      }

      return NextResponse.json({
        ok: true,
        changed: true,
        message: `Code promo de ${order.order_number} finalisé ✓`,
      });
    }

    if (confirmation !== "LIBERER") {
      return jsonError("Confirmation « LIBERER » requise.", 400);
    }

    if (processedPayment(order.payment_status)) {
      return jsonError(
        "Paiement traité : impossible de libérer le stock avec cette action.",
        409,
      );
    }

    if (PROTECTED_FULFILMENT_STATES.has(String(order.status || ""))) {
      return jsonError(
        "Cette commande est déjà dans le flux de préparation/livraison. Vérification manuelle requise.",
        409,
      );
    }

    if (!UNPAID_RECOVERY_STATES.has(String(order.payment_status || ""))) {
      return jsonError("État de paiement non compatible avec cette récupération.", 409);
    }

    if (!orderIsRecoverable(order)) {
      return jsonError(
        "La fenêtre de paiement est encore active. Aucune réservation n’a été modifiée.",
        409,
      );
    }

    if (!order.stock_reserved && !order.promo_reserved) {
      return NextResponse.json({
        ok: true,
        changed: false,
        message: `${order.order_number} ne conserve plus aucune réservation ✓`,
      });
    }

    // Secure Stripe before touching stock. Recovery never releases an order
    // while a Checkout Session can still become paid.
    if (order.payment_method === "online" && order.stripe_checkout_session_id) {
      const stripe = getStripeServer();
      if (!stripe) {
        return jsonError("Stripe n’est pas configuré.", 503);
      }

      try {
        const session = await stripe.checkout.sessions.retrieve(
          order.stripe_checkout_session_id,
        );

        if (session.status === "complete") {
          if (session.payment_status === "paid") {
            await markStripeOrderPaid(supabase, session);
            return jsonError(
              "Stripe confirme le paiement. La commande a été resynchronisée et le stock n’a pas été libéré.",
              409,
            );
          }

          return jsonError(
            "La session Stripe est finalisée mais son paiement n’est pas confirmé. Vérification manuelle requise.",
            409,
          );
        }

        if (session.status === "open") {
          await stripe.checkout.sessions.expire(session.id);
        }
      } catch (stripeError) {
        console.error("Commerce recovery Stripe error", stripeError);
        return jsonError(
          "Impossible de sécuriser la session Stripe. Aucune réservation n’a été libérée.",
          502,
        );
      }
    }

    // Mark stale online attempts expired before releasing reservations.
    // The Stripe session is already expired/closed at this point.
    if (
      order.status === "pending" &&
      order.payment_method === "online" &&
      ["pending", "unpaid"].includes(String(order.payment_status || ""))
    ) {
      const { data: expiredOrder, error: expireError } = await supabase
        .from("orders")
        .update({
          payment_status: "expired",
          payment_expires_at: null,
        })
        .eq("id", order.id)
        .eq("status", "pending")
        .in("payment_status", ["pending", "unpaid"])
        .select("id,payment_status")
        .maybeSingle();

      if (expireError) throw expireError;

      if (!expiredOrder) {
        const latest = await loadOrder(supabase, order.id);
        if (latest && processedPayment(latest.payment_status)) {
          return jsonError(
            "Le paiement a changé d’état pendant la récupération. Le stock n’a pas été libéré.",
            409,
          );
        }
        return jsonError(
          "La commande a changé d’état. Actualisez le diagnostic avant de réessayer.",
          409,
        );
      }
    }

    const latest = await loadOrder(supabase, order.id);
    if (!latest) return jsonError("Commande introuvable.", 404);

    if (processedPayment(latest.payment_status)) {
      return jsonError(
        "Le paiement vient d’être confirmé. Le stock n’a pas été libéré.",
        409,
      );
    }

    let stockReleased = false;
    let promoReleased = false;

    if (latest.stock_reserved) {
      const { error: stockError } = await supabase.rpc(
        "release_shop_order_stock",
        { p_order_id: latest.id },
      );

      if (stockError) {
        console.error("Commerce recovery stock error", stockError);
        return jsonError(
          "La commande est sécurisée, mais la libération du stock a échoué. Réessayez.",
          503,
          { changed: false },
        );
      }
      stockReleased = true;
    }

    if (latest.promo_reserved) {
      const { error: promoError } = await supabase.rpc("release_order_promo", {
        p_order_id: latest.id,
      });

      if (promoError) {
        console.error("Commerce recovery promo error", promoError);
        return jsonError(
          stockReleased
            ? "Stock libéré, mais le code promo doit encore être libéré. Actualisez puis réessayez."
            : "La libération du code promo a échoué. Réessayez.",
          503,
          { changed: stockReleased },
        );
      }
      promoReleased = true;
    }

    return NextResponse.json({
      ok: true,
      changed: stockReleased || promoReleased,
      stockReleased,
      promoReleased,
      message: `${order.order_number} : réservations libérées ✓`,
    });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    console.error("Commerce recovery error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Récupération commerce impossible.",
      },
      { status },
    );
  }
}
