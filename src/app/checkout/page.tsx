"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import EmbeddedStripePayment from "@/components/EmbeddedStripePayment";
import type { CartItem } from "@/lib/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { normalizeLegacyProductLabel } from "@/lib/product-label";

type OrderResult = {
  orderNumber: string;
  publicToken?: string;
  total?: number;
  subtotal?: number;
  pickupTime?: string | null;
  orderType?: "pickup" | "shipping";
  shippingMethodName?: string | null;
  shippingFee?: number;
  packageWeightG?: number;
  paymentMethod?: "online" | "pickup";
  paymentStatus?: string;
  checkoutSessionClientSecret?: string | null;
  checkoutSessionId?: string | null;
  trackingUrl?: string | null;
  paymentComplete?: boolean;
  demo?: boolean;
};

type ShippingMethod = {
  id: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  fee: number;
  freeThreshold: number | null;
  free: boolean;
  maxWeightG: number;
};

type ShippingQuoteResult = {
  subtotal: number;
  itemWeightG: number;
  packagingWeightG: number;
  packageWeightG: number;
  methods: ShippingMethod[];
};
type AppliedPromo = {
  code: string;
  campaignName: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
};

type AddressSuggestion = {
  id: string;
  label: string;
  address1: string;
  postalCode: string;
  city: string;
};

type CitySuggestion = {
  name: string;
};

const MIN_ONLINE_PAYMENT_EUR = 1;

function minimumPaymentMessage(language: "fr" | "en") {
  return language === "fr"
    ? "Le montant minimum pour un paiement en ligne est de 1,00 €."
    : "The minimum amount for an online payment is €1.00.";
}


function localDateTimeMin() {
  const date = new Date(Date.now() + 10 * 60 * 1000);
  date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function cartPayload(items: CartItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
    choices: item.choices.map((choice) => ({ groupId: choice.groupId, valueId: choice.valueId })),
  }));
}

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const cms = (fr: string, en: string, fallbackFr: string, fallbackEn: string) => settings[language === "fr" ? fr : en] || (language === "fr" ? fallbackFr : fallbackEn);
  const mustPickup = items.some((item) => item.pickupOnly);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [errorReference, setErrorReference] = useState("");
  const [errorDebug, setErrorDebug] = useState("");
  const [paymentSession, setPaymentSession] = useState<{
    clientSecret: string;
    orderNumber: string;
    publicToken?: string;
    total: number;
    trackingUrl?: string | null;
  } | null>(null);
  const [orderType, setOrderType] = useState<"pickup" | "shipping">(mustPickup ? "pickup" : "shipping");
  const [pickupMode, setPickupMode] = useState<"asap" | "scheduled">("asap");
  const clientReferenceRef = useRef<string | null>(null);
  const [quote, setQuote] = useState<ShippingQuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [shippingMethodId, setShippingMethodId] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");
  const [promoExpanded, setPromoExpanded] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showAddress2, setShowAddress2] = useState(false);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressVerified, setAddressVerified] = useState(false);
  const [addressEntryMode, setAddressEntryMode] = useState<"search" | "manual">("search");
  const [addressSearchAttempted, setAddressSearchAttempted] = useState(false);
  const [addressLookupUnavailable, setAddressLookupUnavailable] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const [customerFirstName, setCustomerFirstName] = useState("");
  const [customerLastName, setCustomerLastName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPrefilled, setCustomerPrefilled] = useState(false);
  const money = useMemo(() => new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: "EUR" }), [language]);

  useEffect(() => {
    if (!mustPickup) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setOrderType("pickup");
    });
    return () => { cancelled = true; };
  }, [mustPickup]);

  // V2.43 — A signed-in customer gets their verified profile and default address
  // prefilled without making account creation mandatory for checkout.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;
    let active = true;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!active || !user) return;

      await supabase.rpc("claim_customer_orders");
      const [{ data: profile }, { data: defaultAddress }] = await Promise.all([
        supabase.from("customer_profiles").select("first_name,last_name,phone").eq("id", user.id).maybeSingle(),
        supabase.from("customer_addresses").select("address1,address2,postal_code,city,country").eq("customer_id", user.id).eq("is_default", true).maybeSingle(),
      ]);
      if (!active) return;

      setCustomerFirstName((value) => value || String(profile?.first_name || ""));
      setCustomerLastName((value) => value || String(profile?.last_name || ""));
      setCustomerEmail((value) => value || String(user.email || ""));
      setCustomerPhone((value) => value || String(profile?.phone || ""));

      if (defaultAddress) {
        setAddress1((value) => value || String(defaultAddress.address1 || ""));
        setAddress2((value) => value || String(defaultAddress.address2 || ""));
        setPostalCode((value) => value || String(defaultAddress.postal_code || ""));
        setCity((value) => value || String(defaultAddress.city || ""));
        setAddressEntryMode("manual");
        if (defaultAddress.address2) setShowAddress2(true);
      }
      setCustomerPrefilled(true);
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (orderType !== "shipping" || mustPickup || !items.length) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setQuote(null);
        setQuoteError("");
        setShippingMethodId("");
      });
      return () => { cancelled = true; };
    }
    let active = true;
    async function loadQuote() {
      setQuoteLoading(true);
      setQuoteError("");
      try {
        const response = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ country: "FR", items: cartPayload(items) }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Impossible de calculer la livraison.");
        if (!active) return;
        setQuote(data);
        setShippingMethodId((current) => data.methods.some((method: ShippingMethod) => method.id === current) ? current : (data.methods[0]?.id ?? ""));
      } catch (e) {
        if (active) { setQuote(null); setShippingMethodId(""); setQuoteError(e instanceof Error ? e.message : "Impossible de calculer la livraison."); }
      } finally {
        if (active) setQuoteLoading(false);
      }
    }
    loadQuote();
    return () => { active = false; };
  }, [orderType, mustPickup, items]);

  useEffect(() => {
    if (orderType !== "shipping" || addressEntryMode === "manual") {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setAddressSuggestions([]);
      });
      return () => { cancelled = true; };
    }
    const query = address1.trim();
    if (addressVerified || query.length < 3) {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) return;
        setAddressSuggestions([]);
        if (query.length < 3) {
          setAddressSearchAttempted(false);
          setAddressLookupUnavailable(false);
        }
      });
      return () => { cancelled = true; };
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      try {
        const response = await fetch(`/api/address/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Address lookup failed");
        setAddressSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setAddressSearchAttempted(true);
        setAddressLookupUnavailable(false);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") {
          setAddressSuggestions([]);
          setAddressSearchAttempted(true);
          setAddressLookupUnavailable(true);
        }
      } finally {
        setAddressLoading(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address1, addressVerified, addressEntryMode, orderType]);

  useEffect(() => {
    if (orderType !== "shipping" || !/^\d{5}$/.test(postalCode)) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setCitySuggestions([]);
      });
      return () => { cancelled = true; };
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCityLoading(true);
      try {
        const response = await fetch(`/api/address/cities?postalCode=${encodeURIComponent(postalCode)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "City lookup failed");
        const cities = Array.isArray(data.cities) ? data.cities : [];
        setCitySuggestions(cities);
        if (cities.length === 1 && (!city || !addressVerified)) setCity(String(cities[0].name || ""));
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") setCitySuggestions([]);
      } finally {
        setCityLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [postalCode, orderType, city, addressVerified]);

  const selectedShipping = quote?.methods.find((method) => method.id === shippingMethodId) ?? null;
  const manualAddressReady = addressEntryMode === "manual" && address1.trim().length >= 3 && /^\d{5}$/.test(postalCode) && city.trim().length >= 2;
  const shippingFee = orderType === "shipping" ? Number(selectedShipping?.fee ?? 0) : 0;
  const discountAmount = Number(appliedPromo?.discountAmount || 0);
  const discountedSubtotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const checkoutTotal = Math.round((discountedSubtotal + shippingFee) * 100) / 100;
  const freeShippingGap = orderType === "shipping" && selectedShipping?.freeThreshold && !selectedShipping.free
    ? Math.max(0, Math.round((selectedShipping.freeThreshold - subtotal) * 100) / 100)
    : 0;
  const freeShippingProgress = orderType === "shipping" && selectedShipping?.freeThreshold
    ? Math.min(100, Math.max(0, (subtotal / selectedShipping.freeThreshold) * 100))
    : 0;
  const paymentMethod = "online" as const;
  const promoFieldVisible = settings.promo_field_visible !== "false";
  const shippingAddressReady = orderType !== "shipping" || (address1.trim().length >= 3 && /^\d{5}$/.test(postalCode) && city.trim().length >= 2);
  const underMinimumOnlinePayment = checkoutTotal > 0 && checkoutTotal < MIN_ONLINE_PAYMENT_EUR;
  const submitDisabled = loading || underMinimumOnlinePayment || !acceptedTerms || (orderType === "shipping" && (quoteLoading || !selectedShipping || !shippingAddressReady));
  const checkoutBlocker = loading || paymentSession
    ? ""
    : orderType === "shipping" && quoteLoading
      ? (language === "fr" ? "Calcul de la livraison en cours…" : "Calculating delivery…")
      : orderType === "shipping" && quoteError
        ? (language === "fr" ? "Le tarif de livraison doit être disponible avant de continuer." : "A delivery rate must be available before you can continue.")
        : orderType === "shipping" && !shippingAddressReady
          ? (language === "fr" ? "Complétez l’adresse de livraison pour continuer." : "Complete the delivery address to continue.")
          : orderType === "shipping" && !selectedShipping
            ? (language === "fr" ? "Choisissez un mode de livraison pour continuer." : "Choose a delivery method to continue.")
            : underMinimumOnlinePayment
              ? minimumPaymentMessage(language)
            : !acceptedTerms
              ? (language === "fr" ? "Acceptez les CGV et les informations Livraison & retours pour continuer." : "Accept the Terms and Shipping & returns information to continue.")
              : "";

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setAppliedPromo(null);
      setPromoError("");
    });
    return () => { cancelled = true; };
  }, [subtotal]);

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) { setPromoError(language === "fr" ? "Saisissez un code promo." : "Enter a promo code."); return; }
    setPromoLoading(true);
    setPromoError("");
    try {
      const response = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, items: cartPayload(items) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Code promo invalide.");
      setPromoCode(String(data.code || code).toUpperCase());
      setAppliedPromo({
        code: String(data.code),
        campaignName: String(data.campaignName || data.code),
        discountType: data.discountType === "fixed" ? "fixed" : "percent",
        discountValue: Number(data.discountValue || 0),
        discountAmount: Number(data.discountAmount || 0),
      });
    } catch (e) {
      setAppliedPromo(null);
      setPromoError(e instanceof Error ? e.message : (language === "fr" ? "Code promo invalide." : "Invalid promo code."));
    } finally { setPromoLoading(false); }
  }

  function removePromo() {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError("");
    setPromoExpanded(false);
  }

  function chooseAddress(suggestion: AddressSuggestion) {
    setAddress1(suggestion.address1 || suggestion.label);
    setPostalCode(suggestion.postalCode || "");
    setCity(suggestion.city || "");
    setAddressSuggestions([]);
    setAddressVerified(true);
    setAddressEntryMode("search");
    setAddressSearchAttempted(false);
    setAddressLookupUnavailable(false);
  }

  function useManualAddress() {
    setAddressEntryMode("manual");
    setAddressVerified(false);
    setAddressSuggestions([]);
    setAddressSearchAttempted(false);
    setAddressLookupUnavailable(false);
  }

  function useAddressSearch() {
    setAddressEntryMode("search");
    setAddressVerified(false);
    setAddressSuggestions([]);
    setAddressSearchAttempted(false);
    setAddressLookupUnavailable(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clientReference = clientReferenceRef.current ?? window.crypto.randomUUID();
    clientReferenceRef.current = clientReference;
    if (!acceptedTerms) {
      setError(language === "fr" ? "Veuillez accepter les CGV avant de confirmer la commande." : "Please accept the terms before confirming your order.");
      return;
    }
    if (orderType === "shipping" && (!quote || !shippingMethodId)) {
      setError(language === "fr" ? "Le tarif de livraison n’est pas encore disponible." : "Shipping quote is not ready yet.");
      return;
    }
    if (underMinimumOnlinePayment) {
      setError(minimumPaymentMessage(language));
      setErrorCode("ORDER_PAYMENT_MINIMUM");
      setErrorReference("");
      setErrorDebug("");
      return;
    }
    setLoading(true); setError(""); setErrorCode(""); setErrorReference(""); setErrorDebug("");
    const form = new FormData(event.currentTarget);
    const pickupValue = String(form.get("pickupTime") || "");
    const payload = {
      clientReference,
      customer: {
        firstName: String(form.get("firstName") || ""),
        lastName: String(form.get("lastName") || ""),
        email: String(form.get("email") || ""),
        phone: String(form.get("phone") || ""),
      },
      pickupMode,
      pickupTime: orderType === "pickup" && pickupMode === "scheduled" && pickupValue ? new Date(pickupValue).toISOString() : null,
      shipping: orderType === "shipping" ? {
        methodId: shippingMethodId,
        address1,
        address2,
        postalCode,
        city,
        country: "FR",
      } : null,
      notes: String(form.get("notes") || ""),
      orderType,
      paymentMethod,
      acceptedTerms: true,
      promoCode: appliedPromo?.code || "",
      items: cartPayload(items),
    };
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const raw = await response.text();
      let data: any = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!response.ok) {
        const responseCode = String(data.code || "ORDER_HTTP_ERROR");
        setError(
          responseCode === "ORDER_PAYMENT_MINIMUM"
            ? minimumPaymentMessage(language)
            : data.error || (language === "fr" ? "Impossible de finaliser la commande." : "Unable to complete your order."),
        );
        setErrorCode(responseCode);
        setErrorReference(String(data.reference || ""));
        setErrorDebug(String(data.debug || ""));
        return;
      }
      if (data.paymentComplete || data.paymentStatus === "paid") {
        setResult(data);
        clear();
        return;
      }
      if (data.checkoutSessionClientSecret) {
        setPaymentSession({
          clientSecret: String(data.checkoutSessionClientSecret),
          orderNumber: String(data.orderNumber || ""),
          publicToken: data.publicToken ? String(data.publicToken) : undefined,
          total: Number(data.total ?? checkoutTotal),
          trackingUrl: data.trackingUrl ? String(data.trackingUrl) : null,
        });
        setError("");
        setErrorCode("");
        setErrorReference("");
        setErrorDebug("");
        requestAnimationFrame(() => {
          document.getElementById("embedded-payment-v242")?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        return;
      }
      setError(language === "fr" ? "La session de paiement Stripe n’a pas pu être préparée." : "The Stripe payment session could not be prepared.");
      setErrorCode("ORDER_PAYMENT_SESSION_MISSING");
      setErrorReference(String(data.reference || ""));
    } catch (e) {
      setError(language === "fr" ? "Impossible de contacter le service de commande. Vérifiez votre connexion puis réessayez." : "Unable to reach the order service. Check your connection and try again.");
      setErrorCode("ORDER_NETWORK");
      setErrorReference("");
      setErrorDebug(process.env.NODE_ENV !== "production" && e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }

  if (result) return <section className="checkout-page"><div className="order-success">
    <span>✓</span>
    <p className="eyebrow">ICHIGO ICHIE</p>
    <h1>{language === "fr" ? "Commande enregistrée" : "Order received"}</h1>
    <p>{language === "fr" ? "Numéro de commande" : "Order number"}: <strong>{result.orderNumber}</strong></p>
    {result.orderType === "shipping"
      ? <p className="success-pickup"><strong>{language === "fr" ? "Livraison" : "Shipping"}</strong><br />{result.shippingMethodName}</p>
      : <p className="success-pickup">{result.pickupTime ? `${language === "fr" ? "Retrait" : "Pickup"}: ${new Date(result.pickupTime).toLocaleString(language === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}` : (language === "fr" ? "Retrait : dès que possible" : "Pickup: as soon as possible")}</p>}
    {typeof result.total === "number" && <p className="success-total">Total <strong>{money.format(result.total)}</strong></p>}
    {result.demo && <p>Mode aperçu: la commande n’est pas encore envoyée à Supabase.</p>}
    <div className="success-actions">
      {result.publicToken && <Link className="button primary" href={`/commande/${result.publicToken}`}>{language === "fr" ? "Suivre ma commande" : "Track my order"}</Link>}
      <Link className="button ghost" href="/#boutique">{language === "fr" ? "Retour à la boutique" : "Back to shop"}</Link>
    </div>
  </div></section>;

  if (!items.length) return <section className="checkout-page"><div className="empty-state"><h1>{language === "fr" ? "Votre panier est vide" : "Your cart is empty"}</h1><Link className="button primary" href="/#boutique">Boutique</Link></div></section>;

  return <section className="checkout-page">
    <div className="page-heading"><p className="eyebrow">{cms("checkout_eyebrow_fr", "checkout_eyebrow_en", "ICHIGO ICHIE", "ICHIGO ICHIE")}</p><h1>{cms("checkout_title_fr", "checkout_title_en", "Finaliser la commande", "Complete order")}</h1><p>{cms("checkout_intro_fr", "checkout_intro_en", "Livraison en France métropolitaine ou retrait gratuit à Nice.", "Delivery in metropolitan France or free pickup in Nice.")}</p></div>
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submit}>
        <fieldset className="checkout-details-lock-v242" disabled={Boolean(paymentSession)}>
        {!mustPickup && <div className="pickup-choice-block delivery-mode-block">
          <p className="checkout-step-kicker">01</p><h2>{language === "fr" ? "Comment souhaitez-vous recevoir votre commande ?" : "How would you like to receive your order?"}</h2>
          <div className="pickup-choice-grid">
            <label className={`pickup-choice ${orderType === "shipping" ? "active" : ""}`}><input type="radio" name="orderType" value="shipping" checked={orderType === "shipping"} onChange={() => setOrderType("shipping")} /><span><strong>{language === "fr" ? "Livraison" : "Shipping"}</strong><small>{language === "fr" ? "France métropolitaine · livraison suivie." : "Metropolitan France · tracked delivery."}</small></span></label>
            <label className={`pickup-choice ${orderType === "pickup" ? "active" : ""}`}><input type="radio" name="orderType" value="pickup" checked={orderType === "pickup"} onChange={() => setOrderType("pickup")} /><span><strong>{language === "fr" ? "Retrait boutique" : "Boutique pickup"}</strong><small>14 rue Centrale, Nice · {language === "fr" ? "gratuit" : "free"}</small></span></label>
          </div>
        </div>}

        <div className="checkout-section-card customer-details-card">
          <p className="checkout-step-kicker">02</p>
          <div className="customer-details-title-v243"><h2>{language === "fr" ? "Vos coordonnées" : "Your details"}</h2>{customerPrefilled && <Link href="/compte" className="customer-prefill-badge-v243">✓ {language === "fr" ? "Mon compte" : "My account"}</Link>}</div>
          <div className="form-grid">
          <label>{language === "fr" ? "Prénom *" : "First name *"}<input name="firstName" value={customerFirstName} onChange={(e) => setCustomerFirstName(e.target.value)} autoComplete="given-name" required /></label>
          <label>{language === "fr" ? `Nom${orderType === "shipping" ? " *" : ""}` : `Last name${orderType === "shipping" ? " *" : ""}`}<input name="lastName" value={customerLastName} onChange={(e) => setCustomerLastName(e.target.value)} autoComplete="family-name" required={orderType === "shipping"} /></label>
          <label>Email *<input name="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" autoComplete="email" inputMode="email" placeholder="vous@exemple.fr" required /></label>
          <label>{language === "fr" ? "Téléphone *" : "Phone *"}<input name="phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" autoComplete="tel" inputMode="tel" placeholder="+33 6 12 34 56 78" required /></label>
          </div>
        </div>

        {orderType === "shipping" ? <>
          <div className="shipping-address-block checkout-section-card smart-address-card-v235">
            <div className="smart-section-head-v235">
              <div><p className="checkout-step-kicker">{language === "fr" ? "ADRESSE" : "ADDRESS"}</p><h2>{language === "fr" ? "Où livrer votre commande ?" : "Where should we deliver?"}</h2></div>
              {addressVerified ? <span className="smart-verified-v235">✓ {language === "fr" ? "Adresse reconnue" : "Address found"}</span> : manualAddressReady ? <span className="smart-manual-status-v2351">✓ {language === "fr" ? "Adresse saisie manuellement" : "Address entered manually"}</span> : null}
            </div>
            <label className="smart-address-search-v235">
              {addressEntryMode === "manual" ? (language === "fr" ? "Adresse *" : "Address *") : (language === "fr" ? "Commencez à saisir votre adresse *" : "Start typing your address *")}
              <div className="smart-input-wrap-v235">
                <input
                  name="address1"
                  value={address1}
                  onChange={(e) => { setAddress1(e.target.value); setAddressVerified(false); }}
                  autoComplete="shipping address-line1"
                  placeholder={language === "fr" ? "Ex. 14 rue Centrale, Nice" : "E.g. 14 rue Centrale, Nice"}
                  required
                />
                {addressEntryMode === "search" && addressLoading && <span className="smart-field-loading-v235" aria-hidden="true">…</span>}
              </div>
              {addressEntryMode === "search" && addressSuggestions.length > 0 && <div className="smart-address-suggestions-v235" role="listbox">
                {addressSuggestions.map((suggestion) => <button key={suggestion.id} type="button" role="option" aria-selected={false} onClick={() => chooseAddress(suggestion)}>
                  <strong>{suggestion.address1 || suggestion.label}</strong>
                  <small>{[suggestion.postalCode, suggestion.city].filter(Boolean).join(" · ")}</small>
                </button>)}
              </div>}
              <small className="smart-helper-v235">{addressEntryMode === "manual"
                ? (language === "fr" ? "Saisissez le numéro et la voie, puis complétez le code postal et la ville ci-dessous." : "Enter the street number and street, then complete the postcode and city below.")
                : (language === "fr" ? "Sélectionnez une suggestion pour remplir automatiquement le code postal et la ville." : "Choose a suggestion to fill the postcode and city automatically.")}</small>
            </label>

            {addressEntryMode === "search" && addressSearchAttempted && !addressLoading && addressSuggestions.length === 0 && !addressVerified && address1.trim().length >= 3 && <div className={`smart-address-fallback-v2351 ${addressLookupUnavailable ? "warning" : ""}`}>
              <div>
                <strong>{addressLookupUnavailable
                  ? (language === "fr" ? "La recherche d’adresse est momentanément indisponible." : "Address search is temporarily unavailable.")
                  : (language === "fr" ? "Adresse non trouvée dans les suggestions ?" : "Address not found in the suggestions?")}</strong>
                <small>{language === "fr" ? "Vous pouvez continuer la commande en saisissant l’adresse manuellement." : "You can continue the order by entering the address manually."}</small>
              </div>
              <button type="button" onClick={useManualAddress}>{language === "fr" ? "Saisir manuellement" : "Enter manually"}</button>
            </div>}

            {addressEntryMode === "search" && !addressVerified && !(addressSearchAttempted && addressSuggestions.length === 0 && address1.trim().length >= 3) && <button type="button" className="smart-text-button-v235 smart-manual-link-v2351" onClick={useManualAddress}>{language === "fr" ? "Adresse introuvable ? Saisir manuellement" : "Can't find the address? Enter it manually"}</button>}
            {addressEntryMode === "manual" && <button type="button" className="smart-text-button-v235 smart-manual-link-v2351" onClick={useAddressSearch}>← {language === "fr" ? "Rechercher automatiquement" : "Search automatically"}</button>}

            {!showAddress2 ? <button type="button" className="smart-text-button-v235" onClick={() => setShowAddress2(true)}>+ {language === "fr" ? "Ajouter bâtiment, étage ou code d’accès" : "Add building, floor or access code"}</button> :
              <label>{language === "fr" ? "Complément d’adresse" : "Address line 2"}<input name="address2" value={address2} onChange={(e) => setAddress2(e.target.value)} autoComplete="shipping address-line2" placeholder={language === "fr" ? "Bâtiment, étage, code…" : "Building, floor, access code…"} /></label>}

            <div className="form-grid smart-city-grid-v235">
              <label>{language === "fr" ? "Code postal *" : "Postal code *"}
                <input name="postalCode" value={postalCode} onChange={(e) => { setPostalCode(e.target.value.replace(/\D/g, "").slice(0,5)); setAddressVerified(false); }} inputMode="numeric" pattern="[0-9]{5}" maxLength={5} autoComplete="shipping postal-code" required />
              </label>
              <label>{language === "fr" ? "Ville *" : "City *"}
                {citySuggestions.length > 1 ? <select name="city" value={city} onChange={(e) => setCity(e.target.value)} required>
                  <option value="">{cityLoading ? "…" : (language === "fr" ? "Choisir la ville" : "Choose city")}</option>
                  {citySuggestions.map((option) => <option key={option.name} value={option.name}>{option.name}</option>)}
                </select> : <div className="smart-input-wrap-v235"><input name="city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="shipping address-level2" required />{cityLoading && <span className="smart-field-loading-v235">…</span>}</div>}
              </label>
            </div>
            <div className="smart-country-v235"><span>{language === "fr" ? "Pays" : "Country"}</span><strong>France</strong><small>{language === "fr" ? "France métropolitaine" : "Metropolitan France"}</small></div>
          </div>

          <div className="shipping-method-block checkout-section-card">
            <div className="section-inline"><div><p className="checkout-step-kicker">03</p><h2>{language === "fr" ? "Mode de livraison" : "Delivery method"}</h2></div></div>
            {quoteLoading && <p className="shipping-note">{language === "fr" ? "Calcul du tarif de livraison…" : "Calculating delivery rate…"}</p>}
            {quoteError && <p className="form-error">{quoteError}</p>}
            {quote?.methods.map((method) => <label key={method.id} className={`shipping-method ${shippingMethodId === method.id ? "active" : ""}`}>
              <input type="radio" name="shippingMethod" value={method.id} checked={shippingMethodId === method.id} onChange={() => setShippingMethodId(method.id)} />
              <span><strong>{language === "fr" ? method.nameFr : method.nameEn}</strong><small>{language === "fr" ? method.descriptionFr : method.descriptionEn}{method.freeThreshold ? ` · ${language === "fr" ? "offerte dès" : "free from"} ${money.format(method.freeThreshold)}` : ""}</small></span>
              <b>{method.free ? (language === "fr" ? "Offert" : "Free") : money.format(method.fee)}</b>
            </label>)}
          </div>
        </> : <div className="pickup-choice-block checkout-section-card">
          <p className="checkout-step-kicker">03</p><h2>{language === "fr" ? "Quand souhaitez-vous retirer ?" : "When would you like to pick up?"}</h2>
          <div className="pickup-choice-grid">
            <label className={`pickup-choice ${pickupMode === "asap" ? "active" : ""}`}><input type="radio" name="pickupMode" value="asap" checked={pickupMode === "asap"} onChange={() => setPickupMode("asap")} /><span><strong>{language === "fr" ? "Dès que possible" : "As soon as possible"}</strong><small>{language === "fr" ? "La boutique prépare la commande dès réception." : "The boutique starts preparing as soon as it is received."}</small></span></label>
            <label className={`pickup-choice ${pickupMode === "scheduled" ? "active" : ""}`}><input type="radio" name="pickupMode" value="scheduled" checked={pickupMode === "scheduled"} onChange={() => setPickupMode("scheduled")} /><span><strong>{language === "fr" ? "Planifier" : "Schedule"}</strong><small>{language === "fr" ? "Choisissez une date et une heure." : "Choose a date and time."}</small></span></label>
          </div>
          {pickupMode === "scheduled" && <label className="scheduled-time">{language === "fr" ? "Date et heure de retrait" : "Pickup date and time"}<input name="pickupTime" type="datetime-local" min={localDateTimeMin()} required /></label>}
        </div>}

        {promoFieldVisible && <div className={`smart-optional-card-v235 ${appliedPromo || promoExpanded ? "open" : ""}`}>
          {!appliedPromo && <button type="button" className="smart-optional-trigger-v235" onClick={() => setPromoExpanded((value) => !value)}>
            <span><strong>{language === "fr" ? "Vous avez un code promo ?" : "Have a promo code?"}</strong><small>{language === "fr" ? "Ajoutez-le avant le paiement." : "Add it before payment."}</small></span><b>{promoExpanded ? "−" : "+"}</b>
          </button>}
          {appliedPromo ? <div className="promo-applied-v234 smart-promo-applied-v235"><div><span>✓</span><strong>{appliedPromo.code}</strong><small>{appliedPromo.campaignName}</small></div><div><strong>− {money.format(appliedPromo.discountAmount)}</strong><button type="button" onClick={removePromo}>{language === "fr" ? "Retirer" : "Remove"}</button></div></div> :
            promoExpanded && <div className="smart-optional-body-v235"><div className="promo-entry-v234"><input value={promoCode} onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/\s+/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }} placeholder={language === "fr" ? "Ex. MATCHA10" : "E.g. MATCHA10"} maxLength={40} autoComplete="off" /><button type="button" className="button ghost" disabled={promoLoading || !promoCode.trim()} onClick={applyPromo}>{promoLoading ? "…" : (language === "fr" ? "Appliquer" : "Apply")}</button></div>{promoError && <p className="promo-error-v234">{promoError}</p>}</div>}
        </div>}

        <div className="smart-payment-v235">
          <span className="smart-payment-icon-v235" aria-hidden="true">✓</span>
          <div><p className="checkout-step-kicker">04 · {language === "fr" ? "PAIEMENT" : "PAYMENT"}</p><strong>{language === "fr" ? "Paiement sécurisé sur Ichigo Ichie" : "Secure payment on Ichigo Ichie"}</strong><small>{language === "fr" ? "Carte, Link et portefeuilles compatibles, traités en toute sécurité par Stripe." : "Card, Link and compatible wallets, securely processed by Stripe."}</small></div>
          <span className="secure-payment-pill">Stripe</span>
        </div>

        {!showNotes ? <button type="button" className="smart-text-button-v235 smart-note-trigger-v235" onClick={() => setShowNotes(true)}>+ {language === "fr" ? "Ajouter une note à la boutique" : "Add a note for the boutique"}</button> :
          <label>{language === "fr" ? "Note pour la boutique" : "Note for the boutique"}<textarea name="notes" rows={3} maxLength={1000} placeholder={language === "fr" ? "Précision, demande particulière…" : "Request, special note…"}></textarea></label>}
        <label className="checkout-terms-v227"><input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} /><span>{language === "fr" ? <>J’ai lu et j’accepte les <Link href="/cgv" target="_blank">CGV</Link> ainsi que les informations <Link href="/livraison-retours" target="_blank">Livraison & retours</Link>.</> : <>I have read and accept the <Link href="/cgv" target="_blank">Terms</Link> and <Link href="/livraison-retours" target="_blank">Shipping & returns</Link> information.</>}</span></label>
        </fieldset>
        {error && (errorCode || errorReference || errorDebug ? <div className="order-error-diagnostic-v2391" role="alert">
          <div className="order-error-diagnostic-v2391-head"><span aria-hidden="true">!</span><div><strong>{error}</strong><p>{language === "fr" ? "Aucun paiement n’a été effectué. Corrigez le point indiqué puis réessayez." : "No payment was taken. Fix the issue shown and try again."}</p></div></div>
          {(errorCode || errorReference) && <div className="order-error-diagnostic-v2391-meta">{errorCode && <code>{errorCode}</code>}{errorReference && <span>{language === "fr" ? "Réf." : "Ref."} <strong>{errorReference}</strong></span>}</div>}
          {errorDebug && <details className="order-error-diagnostic-v2391-debug"><summary>{language === "fr" ? "Détail technique · environnement local" : "Technical detail · local environment"}</summary><code>{errorDebug}</code></details>}
        </div> : <p className="form-error">{error}</p>)}

        {!paymentSession ? <>
          {checkoutBlocker && <p id="checkout-blocker-v405" className="checkout-blocker-v405" role="status" aria-live="polite"><span aria-hidden="true">→</span>{checkoutBlocker}</p>}
          <button className="button primary full checkout-submit" disabled={submitDisabled} aria-describedby={checkoutBlocker ? "checkout-blocker-v405 checkout-disclaimer-v405" : "checkout-disclaimer-v405"}>{loading ? (language === "fr" ? "Préparation du paiement…" : "Preparing payment…") : `${language === "fr" ? "Continuer vers le paiement" : "Continue to payment"} · ${money.format(checkoutTotal)}`}</button>
          <p id="checkout-disclaimer-v405" className="checkout-disclaimer">{language === "fr" ? "Aucun débit à cette étape. Le formulaire Stripe sécurisé s’ouvrira juste ici." : "No charge at this step. The secure Stripe payment form will open here."}</p>

          <div className={`mobile-checkout-paybar-v236 ${checkoutBlocker ? "has-blocker-v405" : ""}`} aria-label={language === "fr" ? "Paiement" : "Payment"}>
            <div><small>Total</small><strong>{money.format(checkoutTotal)}</strong></div>
            <button type="submit" className="button primary" disabled={submitDisabled} aria-describedby={checkoutBlocker ? "mobile-checkout-blocker-v405" : undefined}>
              {loading
  ? "…"
  : language === "fr"
    ? "Continuer vers le paiement"
    : "Continue to payment"}
            </button>
            {checkoutBlocker && <small id="mobile-checkout-blocker-v405" className="mobile-checkout-blocker-v405" role="status" aria-live="polite">{checkoutBlocker}</small>}
          </div>
        </> : <div id="embedded-payment-v242" className="embedded-payment-host-v242">
          <div className="payment-session-ready-v242">
            <span aria-hidden="true">✓</span>
            <div><strong>{language === "fr" ? "Commande préparée pour le paiement" : "Order ready for payment"}</strong><small>{language === "fr" ? "Vos coordonnées sont verrouillées pendant cette session. Aucun débit n’a encore été effectué." : "Your order details are locked for this payment session. Nothing has been charged yet."}</small></div>
          </div>
          <EmbeddedStripePayment
            clientSecret={paymentSession.clientSecret}
            total={paymentSession.total}
            language={language}
            orderNumber={paymentSession.orderNumber}
            returnUrl={paymentSession.trackingUrl ? `${paymentSession.trackingUrl}?payment=success` : null}
          />
        </div>}
      </form>

      <aside className="checkout-summary checkout-summary-v29 checkout-summary-v232 checkout-summary-v236">
        <p className="checkout-summary-kicker">{language === "fr" ? "RÉCAPITULATIF" : "ORDER SUMMARY"}</p>
        <h2>{language === "fr" ? "Votre commande" : "Your order"}</h2>
        <button type="button" className="mobile-summary-toggle-v236" onClick={() => setSummaryExpanded((value) => !value)} aria-expanded={summaryExpanded}>
          <span>{items.reduce((sum, item) => sum + item.quantity, 0)} {language === "fr" ? "article(s)" : "item(s)"}</span>
          <strong>{money.format(checkoutTotal)}</strong>
          <b aria-hidden="true">{summaryExpanded ? "−" : "+"}</b>
        </button>
        <div className={`checkout-summary-products-v236 ${summaryExpanded ? "is-open" : ""}`}>
          {items.map((item) => <div className="checkout-line detailed" key={item.key}><span><strong>{item.quantity} × {normalizeLegacyProductLabel(item.name, language)}</strong>{item.choices.map((choice) => <small key={`${choice.groupId}-${choice.valueId}`}>{choice.groupName}: {choice.valueName}</small>)}</span><strong>{money.format(item.unitPrice * item.quantity)}</strong></div>)}
        </div>
        <div className="checkout-summary-totals">
          <div className="checkout-line"><span>{language === "fr" ? "Sous-total produits" : "Items subtotal"}</span><strong>{money.format(subtotal)}</strong></div>
          {appliedPromo && <div className="checkout-line promo-summary-line-v234"><span><strong>{language === "fr" ? "Réduction" : "Discount"}</strong><small>{appliedPromo.code}</small></span><strong>− {money.format(discountAmount)}</strong></div>}
          {orderType === "shipping" && <div className="checkout-line shipping-total-line"><span><strong>{language === "fr" ? "Livraison" : "Shipping"}</strong>{selectedShipping && <small>{language === "fr" ? selectedShipping.nameFr : selectedShipping.nameEn}</small>}</span><strong>{quoteLoading ? "…" : selectedShipping?.free ? (language === "fr" ? "Offerte" : "Free") : money.format(shippingFee)}</strong></div>}
          <div className="checkout-total"><span>Total</span><strong>{money.format(checkoutTotal)}</strong></div>
        </div>
        {orderType === "shipping" && freeShippingGap > 0 && selectedShipping?.freeThreshold && <div className="smart-free-shipping-v235">
          <div><span>{language === "fr" ? "Livraison offerte" : "Free shipping"}</span><strong>{language === "fr" ? `Encore ${money.format(freeShippingGap)}` : `${money.format(freeShippingGap)} to go`}</strong></div>
          <div className="smart-progress-v235"><span style={{ width: `${freeShippingProgress}%` }} /></div>
        </div>}
        <p className="checkout-summary-note">{orderType === "shipping"
          ? (postalCode || city
              ? `${language === "fr" ? "Livraison vers" : "Delivery to"} ${[postalCode, city].filter(Boolean).join(" ")}.`
              : (language === "fr" ? "Livraison suivie en France métropolitaine." : "Tracked delivery in metropolitan France."))
          : (language === "fr" ? "Retrait : 14 rue Centrale, Nice." : "Pickup: 14 rue Centrale, Nice.")}</p>
      </aside>
    </div>
  </section>;
}
