"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { useCart } from "@/components/CartProvider";
import EmbeddedStripePayment from "@/components/EmbeddedStripePayment";

type PublicOrder = {
  order_number: string;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled" | "refunded";
  payment_status: "unpaid" | "pending" | "paid" | "refunded" | "refund_pending" | "refund_failed" | "failed" | "expired";
  payment_method?: "online" | "pickup";
  payment_expires_at?: string | null;
  order_type: "pickup" | "shipping";
  pickup_time: string | null;
  subtotal: number;
  discount_amount?: number;
  promo_code?: string | null;
  shipping_fee: number;
  total: number;
  created_at: string;
  shipping_method_name?: string | null;
  shipping_address1?: string | null;
  shipping_address2?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country?: string | null;
  package_weight_g?: number | null;
  tracking_carrier?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipped_at?: string | null;
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    line_total: number;
    choices: Array<{ label?: string }>;
  }>;
};

const steps = ["pending", "preparing", "ready", "completed"] as const;

export function OrderTracker({ token }: { token: string }) {
  const { language } = useLanguage();
  const { clear } = useCart();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryPaymentSession, setRetryPaymentSession] = useState<{ clientSecret: string; orderNumber: string; total: number; trackingUrl?: string | null } | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<"success" | "cancelled" | "">("");
  const cartClearedAfterPayment = useRef(false);

  const money = useMemo(() => new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: "EUR" }), [language]);

  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get("payment");
    if (state !== "success" && state !== "cancelled") return;

    setPaymentReturn(state);

    // Remove the payment flag from the address bar once it has been consumed.
    // This prevents Back/refresh from treating the same Stripe return twice.
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);

  const paymentConfirmed = order?.payment_status === "paid" || order?.payment_status === "refunded";

  useEffect(() => {
    if (paymentReturn !== "success" || !paymentConfirmed) return;

    if (!cartClearedAfterPayment.current) {
      cartClearedAfterPayment.current = true;
      clear();
    }

    // Keep the confirmation visible briefly, then return the customer to the shop.
    const timer = window.setTimeout(() => {
      window.location.replace("/#boutique");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [paymentReturn, paymentConfirmed, clear]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/orders/${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Order not found");
        if (active) { setOrder(data); setError(""); setLoading(false); }
      } catch (err) {
        if (active) { setError(err instanceof Error ? err.message : "Order not found"); setLoading(false); }
      }
    }
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  async function retryPayment() {
    setRetrying(true); setError("");
    try {
      const response = await fetch("/api/stripe/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ publicToken: token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Impossible de relancer le paiement.");
      if (data.paid && data.trackingUrl) { window.location.assign(data.trackingUrl); return; }
      if (data.clientSecret) {
        setRetryPaymentSession({
          clientSecret: String(data.clientSecret),
          orderNumber: String(data.orderNumber || order?.order_number || ""),
          total: Number(data.total ?? order?.total ?? 0),
          trackingUrl: data.trackingUrl ? String(data.trackingUrl) : null,
        });
        requestAnimationFrame(() => document.getElementById("tracking-payment-v242")?.scrollIntoView({ behavior: "smooth", block: "center" }));
        setRetrying(false);
        return;
      }
      if (data.url) { window.location.assign(data.url); return; }
      throw new Error(language === "fr" ? "Session de paiement indisponible." : "Payment session unavailable.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de relancer le paiement.");
      setRetrying(false);
    }
  }

  if (loading) return <section className="tracking-page"><div className="tracking-card"><p>{language === "fr" ? "Chargement de la commande…" : "Loading order…"}</p></div></section>;
  if (error && !order) return <section className="tracking-page"><div className="tracking-card"><h1>{language === "fr" ? "Commande introuvable" : "Order not found"}</h1><p>{error}</p><Link className="button primary" href="/#boutique">Boutique</Link></div></section>;
  if (!order) return null;

  const currentIndex = steps.indexOf(order.status as (typeof steps)[number]);
  const isStopped = order.status === "cancelled" || order.status === "refunded";
  const onlinePayment = order.payment_method === "online";
  const paymentPaid = paymentConfirmed;
  const paymentNeedsAction = onlinePayment && ["failed", "expired"].includes(order.payment_status);
  const title = order.payment_status === "refund_pending"
    ? (language === "fr" ? "Remboursement en cours" : "Refund pending")
    : order.payment_status === "refund_failed"
      ? (language === "fr" ? "Remboursement à vérifier" : "Refund needs attention")
      : isStopped
        ? (language === "fr" ? (order.status === "refunded" ? "Commande remboursée" : "Commande annulée") : (order.status === "refunded" ? "Order refunded" : "Order cancelled"))
        : order.order_type === "shipping" && order.status === "completed"
      ? (language === "fr" ? "Commande expédiée" : "Order shipped")
      : order.status === "ready"
        ? (language === "fr" ? (order.order_type === "shipping" ? "Prête à expédier" : "Votre commande est prête !") : (order.order_type === "shipping" ? "Ready to ship" : "Your order is ready!"))
        : order.status === "completed"
          ? (language === "fr" ? "Commande terminée" : "Order completed")
          : (language === "fr" ? "Suivi de votre commande" : "Track your order");

  return <section className="tracking-page"><div className="tracking-card">
    <div className="tracking-head"><div><p className="eyebrow">ICHIGO ICHIE</p><h1>{title}</h1><p>{language === "fr" ? "Commande" : "Order"} <strong>{order.order_number}</strong></p></div><div className={`tracking-status ${order.status}`}>{statusLabel(order.status, language, order.order_type)}</div></div>

    <div className={`payment-tracking-banner ${order.payment_status}`}>
      <div className="payment-tracking-icon">{paymentPaid ? "✓" : order.payment_method === "pickup" ? "€" : paymentNeedsAction ? "!" : "…"}</div>
      <div>
        <strong>{paymentTitle(order, language)}</strong>
        <small>{paymentDescription(order, language, paymentReturn)}</small>
      </div>
      {paymentNeedsAction && !isStopped && !retryPaymentSession && <button type="button" className="button primary small" disabled={retrying} onClick={retryPayment}>{retrying ? (language === "fr" ? "Préparation…" : "Preparing…") : (language === "fr" ? "Réessayer le paiement" : "Retry payment")}</button>}
    </div>
    {error && <p className="form-error">{error}</p>}
    {retryPaymentSession && !paymentPaid && !isStopped && <div id="tracking-payment-v242" className="tracking-embedded-payment-v242">
      <EmbeddedStripePayment clientSecret={retryPaymentSession.clientSecret} total={retryPaymentSession.total} language={language} orderNumber={retryPaymentSession.orderNumber} returnUrl={retryPaymentSession.trackingUrl ? `${retryPaymentSession.trackingUrl}?payment=success` : null} />
    </div>}

    {!isStopped && <div className="tracking-timeline">
      {steps.map((step, index) => <div key={step} className={`tracking-step ${index <= currentIndex ? "done" : ""} ${index === currentIndex ? "current" : ""}`}>
        <span>{index < currentIndex ? "✓" : index + 1}</span>
        <strong>{statusLabel(step, language, order.order_type)}</strong>
      </div>)}
    </div>}

    {order.order_type === "shipping" ? <div className="tracking-pickup shipping-destination"><strong>{language === "fr" ? "Livraison" : "Shipping"}</strong><span>{order.shipping_method_name || (language === "fr" ? "Livraison à domicile" : "Home delivery")}</span><small>{[order.shipping_address1, order.shipping_address2, `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim(), order.shipping_country === "FR" ? "France" : order.shipping_country].filter(Boolean).join(" · ")}</small></div>
      : <div className="tracking-pickup"><strong>{language === "fr" ? "Retrait boutique" : "Boutique pickup"}</strong><span>{order.pickup_time ? new Date(order.pickup_time).toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" }) : (language === "fr" ? "Dès que possible" : "As soon as possible")}</span><small>14 rue Centrale, Nice</small></div>}

    {order.order_type === "shipping" && order.tracking_number && <div className="tracking-parcel-v227"><div><strong>{language === "fr" ? "Suivi du colis" : "Parcel tracking"}</strong><span>{order.tracking_carrier || order.shipping_method_name || "Transporteur"} · {order.tracking_number}</span></div>{order.tracking_url && <a className="button primary small" href={order.tracking_url} target="_blank" rel="noreferrer">{language === "fr" ? "Suivre mon colis ↗" : "Track parcel ↗"}</a>}</div>}

    <div className="tracking-lines">{order.order_items?.map((item) => <div key={item.id}><span><strong>{item.quantity} × {item.product_name}</strong>{item.choices?.length ? <small>{item.choices.map((choice) => choice.label).filter(Boolean).join(" · ")}</small> : null}</span><strong>{money.format(Number(item.line_total))}</strong></div>)}</div>
    {Number(order.discount_amount || 0) > 0 && <div className="tracking-shipping-cost tracking-promo-v234"><span><strong>{language === "fr" ? "Réduction" : "Discount"}</strong>{order.promo_code && <small>{order.promo_code}</small>}</span><strong>− {money.format(Number(order.discount_amount))}</strong></div>}
    {order.order_type === "shipping" && <div className="tracking-shipping-cost"><span>{language === "fr" ? "Livraison" : "Shipping"}</span><strong>{Number(order.shipping_fee) === 0 ? (language === "fr" ? "Offert" : "Free") : money.format(Number(order.shipping_fee))}</strong></div>}
    <div className="tracking-total"><span>Total</span><strong>{money.format(Number(order.total))}</strong></div>
    <p className="tracking-refresh">{language === "fr" ? "Cette page se met à jour automatiquement." : "This page refreshes automatically."}</p>
    <div className="tracking-actions"><Link className="button primary" href="/compte">{language === "fr" ? "Mon espace client" : "My account"}</Link><Link className="button ghost" href="/#boutique">{language === "fr" ? "Retour à la boutique" : "Back to shop"}</Link></div>
  </div></section>;
}

function paymentTitle(order: PublicOrder, language: "fr" | "en") {
  if (order.payment_status === "paid") return language === "fr" ? "Paiement confirmé" : "Payment confirmed";
  if (order.payment_status === "refunded") return language === "fr" ? "Paiement remboursé" : "Payment refunded";
  if (order.payment_status === "refund_pending") return language === "fr" ? "Remboursement en cours" : "Refund pending";
  if (order.payment_status === "refund_failed") return language === "fr" ? "Remboursement à vérifier" : "Refund needs attention";
  if (order.payment_method === "pickup") return language === "fr" ? "Paiement au retrait" : "Pay at pickup";
  if (order.payment_status === "failed") return language === "fr" ? "Paiement échoué" : "Payment failed";
  if (order.payment_status === "expired") return language === "fr" ? "Session de paiement expirée" : "Payment session expired";
  return language === "fr" ? "Confirmation du paiement en cours" : "Payment confirmation pending";
}

function paymentDescription(order: PublicOrder, language: "fr" | "en", paymentReturn: "success" | "cancelled" | "") {
  if (order.payment_status === "paid") return paymentReturn === "success"
    ? (language === "fr" ? "Paiement confirmé. Retour à la boutique dans quelques secondes…" : "Payment confirmed. Returning to the shop in a few seconds…")
    : (language === "fr" ? "Stripe a confirmé le règlement de cette commande." : "Stripe confirmed payment for this order.");
  if (order.payment_status === "refunded") return language === "fr" ? "Le remboursement a été confirmé." : "The refund has been confirmed.";
  if (order.payment_status === "refund_pending") return language === "fr" ? "La demande de remboursement a été transmise à Stripe." : "The refund request was sent to Stripe.";
  if (order.payment_status === "refund_failed") return language === "fr" ? "Le remboursement nécessite une vérification par la boutique." : "The refund needs to be reviewed by the shop.";
  if (order.payment_method === "pickup") return language === "fr" ? "Vous réglerez directement à la boutique lors du retrait." : "Pay directly at the boutique when collecting your order.";
  if (order.payment_status === "failed") return language === "fr" ? "Le règlement n’a pas abouti. Vous pouvez recommencer sans recréer la commande." : "The payment did not complete. You can retry without creating a new order.";
  if (order.payment_status === "expired") return language === "fr" ? "La réservation de paiement a expiré. Cliquez sur Réessayer pour générer une nouvelle session." : "The payment reservation expired. Retry to create a new session.";
  if (paymentReturn === "cancelled") return language === "fr" ? "Vous avez quitté Stripe sans payer. La session peut être reprise tant qu’elle reste ouverte." : "You left Stripe without paying. You can resume while the session remains open.";
  return language === "fr" ? "La page s’actualise automatiquement dès que Stripe confirme le paiement." : "This page updates automatically as soon as Stripe confirms the payment.";
}

function statusLabel(status: PublicOrder["status"] | (typeof steps)[number], language: "fr" | "en", type: "pickup" | "shipping") {
  const pickupFr: Record<string, string> = { pending: "Nouvelle", preparing: "En préparation", ready: "Prête", completed: "Terminée", cancelled: "Annulée", refunded: "Remboursée" };
  const pickupEn: Record<string, string> = { pending: "Received", preparing: "Preparing", ready: "Ready", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded" };
  const shippingFr: Record<string, string> = { pending: "Reçue", preparing: "Préparation colis", ready: "Prête à expédier", completed: "Expédiée", cancelled: "Annulée", refunded: "Remboursée" };
  const shippingEn: Record<string, string> = { pending: "Received", preparing: "Packing", ready: "Ready to ship", completed: "Shipped", cancelled: "Cancelled", refunded: "Refunded" };
  if (type === "shipping") return (language === "fr" ? shippingFr : shippingEn)[status] ?? status;
  return (language === "fr" ? pickupFr : pickupEn)[status] ?? status;
}
