import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendMerchantOrderNotification, sendOrderEmail } from "@/lib/order-email";
import { issueAndEmailInvoice } from "@/lib/invoice";

let stripeClient: Stripe | null | undefined;

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
    .select("id,order_number,public_token,payment_status,payment_method,stripe_checkout_session_id,customer_email,shipping_fee,shipping_method_name,total,stock_reserved,promo_code_id,promo_code,discount_amount,promo_reserved,order_items(id,product_name,quantity,unit_price,choices)")
    .eq("id", orderId)
    .single();
  if (error || !order) throw error ?? new Error("Commande introuvable.");

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

  const { error: updateError } = await supabase.from("orders").update({
    payment_method: "online",
    payment_status: "pending",
    stripe_checkout_session_id: session.id,
    payment_expires_at: new Date(expiresAt * 1000).toISOString(),
  }).eq("id", order.id);
  if (updateError) throw updateError;

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

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
  await supabase.from("orders").update({
    payment_method: "online",
    payment_status: "paid",
    paid_at: new Date().toISOString(),
    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    payment_expires_at: null,
  }).eq("id", orderId).neq("payment_status", "refunded").neq("payment_status", "refund_pending");
  const { error: promoCommitError } = await supabase.rpc("commit_order_promo", { p_order_id: orderId });
  if (promoCommitError) console.error("Promo commit error", promoCommitError);
  // Customer lifecycle: confirmation first, accounting document second.
  // Both sends are idempotent and neither failure blocks the paid order state.
  try { await sendOrderEmail(supabase, orderId, "confirmation"); }
  catch (emailError) { console.error("Order confirmation email error", emailError); }
  try { await issueAndEmailInvoice(supabase, orderId); }
  catch (invoiceError) { console.error("Automatic invoice error", invoiceError); }
  try { await sendMerchantOrderNotification(supabase, orderId); }
  catch (merchantEmailError) { console.error("Merchant order notification email error", merchantEmailError); }
}

export async function markStripeOrderUnpaid(
  supabase: SupabaseClient,
  session: Stripe.Checkout.Session,
  status: "failed" | "expired",
) {
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  const { data: order } = await supabase.from("orders").select("payment_status,stripe_checkout_session_id").eq("id", orderId).maybeSingle();
  if (!order || order.payment_status === "paid" || order.payment_status === "refunded") return;
  // Ignore late events from an older payment attempt. Only the currently
  // attached Checkout Session is allowed to release this order's stock.
  if (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== session.id) return;

  await supabase.from("orders").update({
    payment_method: "online",
    payment_status: status,
    stripe_checkout_session_id: session.id,
    payment_expires_at: null,
  }).eq("id", orderId);
  await supabase.rpc("release_shop_order_stock", { p_order_id: orderId });
  const { error: promoReleaseError } = await supabase.rpc("release_order_promo", { p_order_id: orderId });
  if (promoReleaseError) console.error("Promo release error", promoReleaseError);
}
