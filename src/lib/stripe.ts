import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMerchantOrderNotification, sendOrderEmail, sendPickupStaffOrderNotification } from "@/lib/order-email";
import { ensureInvoiceForOrder } from "@/lib/invoice";
import { PAYMENT_UNPAID_SOURCE_STATES } from "@/lib/stripe-order-transitions";

let stripeClient: Stripe | null | undefined;

export const MINIMUM_ONLINE_PAYMENT_EUR_CENTS = 100;

export class MinimumOnlinePaymentError extends Error {
  readonly code = "ORDER_PAYMENT_MINIMUM";
  readonly status = 409;
  readonly totalCents: number;

  constructor(totalCents: number) {
    super("Le montant minimum pour un paiement en ligne est de 1,00 €.");
    this.name = "MinimumOnlinePaymentError";
    this.totalCents = totalCents;
  }
}

export function assertMinimumOnlinePayment(total: number) {
  const totalCents = Math.round(Number(total || 0) * 100);
  if (totalCents > 0 && totalCents < MINIMUM_ONLINE_PAYMENT_EUR_CENTS) {
    throw new MinimumOnlinePaymentError(totalCents);
  }
}

export function getStripeServer() {
  if (stripeClient !== undefined) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  stripeClient = key ? new Stripe(key, { maxNetworkRetries: 2 }) : null;
  return stripeClient;
}

function siteOrigin(requestOrigin?: string) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return (requestOrigin || "http://localhost:3000").replace(/\/$/, "");
}

function choiceDescription(choices: unknown) {
  if (!Array.isArray(choices)) return "";
  const labels = choices
    .map((choice) => {
      if (!choice || typeof choice !== "object") return "";
      const row = choice as Record<string, unknown>;
      const group = String(row.groupName ?? row.group_name ?? "").trim();
      const value = String(row.valueName ?? row.value_name ?? row.label ?? "").trim();
      return group && value ? `${group}: ${value}` : value;
    })
    .filter(Boolean);
  return labels.join(" · ").slice(0, 500);
}

export async function createOrReuseStripeCheckout(
  supabase: SupabaseClient,
  orderId: string,
  requestOrigin?: string,
) {
  const stripe = getStripeServer();
  if (!stripe) throw new Error("Stripe n’est pas configuré sur le serveur.");

  const { data: order, error } = await supabase
    .from("orders")
    .select("id,order_number,order_type,public_token,payment_status,payment_method,stripe_checkout_session_id,customer_email,shipping_fee,shipping_method_name,total,stock_reserved,promo_code_id,promo_code,discount_amount,promo_reserved,order_items(id,product_name,quantity,unit_price,choices)")
    .eq("id", orderId)
    .single();
  if (error || !order) throw error ?? new Error("Commande introuvable.");

  assertMinimumOnlinePayment(Number(order.total || 0));

  const origin = siteOrigin(requestOrigin);
  const trackingUrl = `${origin}/commande/${order.public_token}`;

  if (order.payment_status === "paid") {
    return {
      clientSecret: null,
      sessionId: order.stripe_checkout_session_id ?? null,
      trackingUrl,
      alreadyPaid: true,
    };
  }

  // Stock and promo are reserved before a payment session is presented. This
  // prevents two customers from paying for the last unit at the same time.
  if (!order.stock_reserved) {
    const { error: stockError } = await supabase.rpc("reserve_shop_order_stock", { p_order_id: order.id });
    if (stockError) throw stockError;
  }
  if (order.promo_code_id && !order.promo_reserved) {
    const { error: promoError } = await supabase.rpc("reserve_order_promo", { p_order_id: order.id });
    if (promoError) throw promoError;
  }

  // Reuse an open Elements Checkout Session so refreshing the payment step does
  // not create duplicate sessions. Older custom/hosted sessions are expired
  // and replaced with an Elements session compatible with React Stripe.js v6+.
  if (order.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);

      if (existing.status === "complete" && existing.payment_status === "paid") {
        await markStripeOrderPaid(supabase, existing);
        return {
          clientSecret: null,
          sessionId: existing.id,
          trackingUrl,
          alreadyPaid: true,
        };
      }

      const currentMethods = existing.payment_method_types ?? [];
      const leanPaymentMethods =
        currentMethods.includes("card") &&
        currentMethods.every((method) => method === "card" || method === "link");

      if (existing.status === "open" && existing.ui_mode === "elements" && existing.client_secret && leanPaymentMethods) {
        await supabase.from("orders").update({
          payment_method: "online",
          payment_status: "pending",
          payment_expires_at: existing.expires_at ? new Date(existing.expires_at * 1000).toISOString() : null,
        }).eq("id", order.id);

        return {
          clientSecret: existing.client_secret,
          sessionId: existing.id,
          trackingUrl,
          alreadyPaid: false,
        };
      }

      // Replace legacy sessions and sessions created with Stripe's dynamic
      // payment-method list. Ichigo Ichie deliberately keeps checkout focused
      // on cards, Link and card-backed wallets (Apple Pay / Google Pay).
      if (existing.status === "open") {
        try {
          await stripe.checkout.sessions.expire(existing.id);
        } catch (expireError) {
          console.warn("Could not expire superseded Stripe Checkout Session", expireError);
        }
      }
    } catch (retrieveError) {
      console.warn("Could not reuse Stripe Checkout Session", retrieveError);
    }
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = (order.order_items ?? []).map((item: any) => ({
    quantity: Number(item.quantity),
    price_data: {
      currency: "eur",
      unit_amount: Math.round(Number(item.unit_price) * 100),
      product_data: {
        name: String(item.product_name).slice(0, 120),
        ...(choiceDescription(item.choices) ? { description: choiceDescription(item.choices) } : {}),
      },
    },
  }));

  const shippingFee = Number(order.shipping_fee || 0);
  if (shippingFee > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(shippingFee * 100),
        product_data: { name: order.shipping_method_name || "Livraison" },
      },
    });
  }

  if (!lineItems.length) throw new Error("La commande ne contient aucun article.");

  const discountAmount = Math.round(Number(order.discount_amount || 0) * 100);
  let discounts: { coupon: string }[] | undefined;
  if (discountAmount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: discountAmount,
      currency: "eur",
      duration: "once",
      name: order.promo_code ? `Code promo ${String(order.promo_code).slice(0, 40)}` : "Réduction Ichigo Ichie",
      metadata: { order_id: order.id, promo_code: String(order.promo_code || "") },
    });
    discounts = [{ coupon: coupon.id }];
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 31 * 60;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "elements",
    line_items: lineItems,
    ...(discounts ? { discounts } : {}),
    // Keep the payment page intentionally simple. `card` also enables Apple Pay
    // and Google Pay when the browser/device is eligible; Link stays available
    // for customers who want a faster saved-payment flow.
    payment_method_types: ["card", "link"],
    return_url: `${trackingUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: order.order_number,
    customer_email: order.customer_email || undefined,
    locale: "auto",
    expires_at: expiresAt,
    metadata: {
      order_id: order.id,
      order_number: order.order_number,
      public_token: order.public_token,
    },
    payment_intent_data: {
      metadata: {
        order_id: order.id,
        order_number: order.order_number,
      },
    },
  });

  if (!session.client_secret) {
    throw new Error("Stripe n’a pas retourné de client secret pour le paiement intégré.");
  }

  // Never let a late checkout attempt regress a paid/refunded order or
  // overwrite a newer session created by a concurrent retry.
  let attachment = supabase.from("orders").update({
    payment_method: "online",
    payment_status: "pending",
    stripe_checkout_session_id: session.id,
    payment_expires_at: new Date(expiresAt * 1000).toISOString(),
  }).eq("id", order.id).in("payment_status", [...PAYMENT_UNPAID_SOURCE_STATES]);

  attachment = order.stripe_checkout_session_id
    ? attachment.eq("stripe_checkout_session_id", order.stripe_checkout_session_id)
    : attachment.is("stripe_checkout_session_id", null);
  const { data: attachedOrder, error: updateError } = await attachment.select("id").maybeSingle();
  if (updateError || !attachedOrder) {
    try { await stripe.checkout.sessions.expire(session.id); }
    catch (expireError) { console.error("Could not expire unattached Checkout Session", expireError); }
    throw updateError ?? new Error("La commande a changé pendant le paiement. Actualisez et réessayez.");
  }

  // An expiry webhook for the superseded session may have released the stock
  // between the first reservation and the session attachment. Reconfirm stock
  // AFTER attaching the new session, before handing its client secret out.
  if (order.order_type === "shipping") {
    const { error: finalStockError } = await supabase.rpc("reserve_shop_order_stock", { p_order_id: order.id });
    if (finalStockError) {
      try { await stripe.checkout.sessions.expire(session.id); }
      catch (expireError) { console.error("Could not expire checkout without stock", expireError); }
      const { error: cleanupError } = await supabase.rpc("finalize_shipping_checkout_unpaid", {
        p_order_id: order.id,
        p_session_id: session.id,
        p_new_payment_status: "expired",
      });
      if (cleanupError) console.error("Could not finalize checkout without stock", cleanupError);
      throw finalStockError;
    }
  }

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
    trackingUrl,
    alreadyPaid: false,
  };
}

export async function markStripeOrderPaid(supabase: SupabaseClient, session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const { data: current } = await supabase.from("orders").select("payment_status,stripe_checkout_session_id").eq("id", orderId).maybeSingle();
  if (!current || ["refunded", "refund_pending"].includes(current.payment_status)) return;

  // If an older Checkout attempt succeeds after the customer already opened a
  // newer one, accept the successful payment and proactively expire the newer
  // open Session so the same order cannot be paid twice.
  if (current.stripe_checkout_session_id && current.stripe_checkout_session_id !== session.id) {
    const stripe = getStripeServer();
    if (stripe) {
      try {
        const newer = await stripe.checkout.sessions.retrieve(current.stripe_checkout_session_id);
        if (newer.status === "open") await stripe.checkout.sessions.expire(newer.id);
      } catch (expireError) {
        console.warn("Could not expire superseded Stripe Checkout Session", expireError);
      }
    }
  }

  // Webhooks can be delivered more than once or concurrently.
  // Only the first transition to "paid" sets the original payment timestamp.
  if (current.payment_status !== "paid") {
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    const { error: paidUpdateError } = await supabase.from("orders").update({
      payment_method: "online",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      payment_expires_at: null,
    }).eq("id", orderId).neq("payment_status", "paid").neq("payment_status", "refunded").neq("payment_status", "refund_pending");
    if (paidUpdateError) throw paidUpdateError;
  }
  // Keep downstream notifications/invoicing retryable under their own idempotency controls.
  const { error: promoCommitError } = await supabase.rpc("commit_order_promo", { p_order_id: orderId });
  if (promoCommitError) console.error("Promo commit error", promoCommitError);
  // Customer lifecycle: send one confirmation e-mail, then issue the
  // accounting document silently. The invoice stays available in tracking and
  // the customer account without creating a second automatic e-mail.
  try { await sendOrderEmail(supabase, orderId, "confirmation"); }
  catch (emailError) { console.error("Order confirmation email error", emailError); }
  try { await ensureInvoiceForOrder(supabase, orderId); }
  catch (invoiceError) { console.error("Automatic invoice issue error", invoiceError); }
  try { await sendMerchantOrderNotification(supabase, orderId); }
  catch (merchantEmailError) { console.error("Merchant order notification email error", merchantEmailError); }
  try { await sendPickupStaffOrderNotification(supabase, orderId); }
  catch (staffEmailError) { console.error("Pickup staff order notification email error", staffEmailError); }
}

export async function markStripeOrderUnpaid(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  status: "failed" | "expired",
) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const { data: order, error: loadError } = await supabase.from("orders")
    .select("payment_status,stripe_checkout_session_id,order_type")
    .eq("id", orderId).maybeSingle();
  if (loadError) throw loadError;
  if (!order || ["paid", "refunded", "refund_pending", "refund_failed"].includes(order.payment_status)) return;
  // Ignore late events from an older payment attempt. Only the currently
  // attached Checkout Session is allowed to release this order's stock.
  if (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id) return;

  // For delivery orders, payment status, stock restoration, and promo
  // restoration MUST commit together. An event replay also heals any
  // historic expired order whose stock is still marked as reserved.
  if (order.order_type === "shipping") {
    const { error: finalizeError } = await supabase.rpc("finalize_shipping_checkout_unpaid", {
      p_order_id: orderId,
      p_session_id: session.id,
      p_new_payment_status: status,
    });
    if (finalizeError) throw finalizeError;
    return;
  }

  // The WHERE clauses are intentionally repeated in the update: another
  // webhook may have completed payment after the initial SELECT.
  let update = supabase.from("orders").update({
    payment_method: "online",
    payment_status: status,
    stripe_checkout_session_id: session.id,
    payment_expires_at: null,
  }).eq("id", orderId).in("payment_status", [...PAYMENT_UNPAID_SOURCE_STATES]);
  update = order.stripe_checkout_session_id
    ? update.eq("stripe_checkout_session_id", session.id)
    : update.is("stripe_checkout_session_id", null);
  const { data: transitioned, error: updateError } = await update.select("id").maybeSingle();
  if (updateError) throw updateError;
  if (!transitioned) return;

  const { error: stockError } = await supabase.rpc("release_shop_order_stock", { p_order_id: orderId });
  if (stockError) throw stockError;
  const { error: promoReleaseError } = await supabase.rpc("release_order_promo", { p_order_id: orderId });
  if (promoReleaseError) console.error("Promo release error", promoReleaseError);
}
