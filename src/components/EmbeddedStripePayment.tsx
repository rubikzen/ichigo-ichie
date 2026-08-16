"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "";
const stripePromise = publishableKey ? loadStripe(publishableKey) : Promise.resolve(null);
const PAYMENT_CONFIRMATION_MARKER_PREFIX = "ichigo:payment-confirming:";

function paymentConfirmationMarkerKey(orderNumber: string) {
  return `${PAYMENT_CONFIRMATION_MARKER_PREFIX}${orderNumber}`;
}

function markPaymentConfirmationStarted(orderNumber: string) {
  try {
    window.sessionStorage.setItem(paymentConfirmationMarkerKey(orderNumber), String(Date.now()));
  } catch {
    // UX-only marker: payment never depends on browser storage.
  }
}

function clearPaymentConfirmationMarker(orderNumber: string) {
  try {
    window.sessionStorage.removeItem(paymentConfirmationMarkerKey(orderNumber));
  } catch {
    // Ignore unavailable browser storage.
  }
}

type EmbeddedStripePaymentProps = {
  clientSecret: string;
  total: number;
  language: "fr" | "en";
  orderNumber: string;
  returnUrl?: string | null;
};

function formatMoney(amount: number, language: "fr" | "en") {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function PaymentContents({ total, language, orderNumber }: Omit<EmbeddedStripePaymentProps, "clientSecret" | "returnUrl">) {
  const checkoutState = useCheckoutElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [expressVisible, setExpressVisible] = useState(false);

  if (checkoutState.type === "loading") {
    return <div className="embedded-payment-loading-v242">{language === "fr" ? "Chargement du paiement sécurisé…" : "Loading secure payment…"}</div>;
  }

  if (checkoutState.type === "error") {
    return <div className="embedded-payment-error-v242" role="alert">{checkoutState.error.message}</div>;
  }

  const { checkout } = checkoutState;

  async function confirmStandardPayment() {
    if (submitting) return;
    setSubmitting(true);
    setPaymentError("");
    markPaymentConfirmationStarted(orderNumber);
    try {
      const result = await checkout.confirm();
      if (result.type === "error") {
        clearPaymentConfirmationMarker(orderNumber);
        setPaymentError(result.error.message || (language === "fr" ? "Le paiement n’a pas pu être confirmé." : "The payment could not be confirmed."));
        setSubmitting(false);
      }
      // On success Stripe completes the flow and follows the return_url of the
      // Checkout Session. Keep the button disabled while that transition occurs.
    } catch (error) {
      clearPaymentConfirmationMarker(orderNumber);
      setPaymentError(error instanceof Error ? error.message : (language === "fr" ? "Erreur de paiement." : "Payment error."));
      setSubmitting(false);
    }
  }

  async function confirmExpressPayment(event: any) {
    if (submitting) return;
    setSubmitting(true);
    setPaymentError("");
    markPaymentConfirmationStarted(orderNumber);
    try {
      const result = await checkout.confirm({
        expressCheckoutConfirmEvent: event,
      });
      if (result.type === "error") {
        clearPaymentConfirmationMarker(orderNumber);
        setPaymentError(result.error.message || (language === "fr" ? "Le paiement express n’a pas pu être confirmé." : "Express payment could not be confirmed."));
        setSubmitting(false);
      }
    } catch (error) {
      clearPaymentConfirmationMarker(orderNumber);
      setPaymentError(error instanceof Error ? error.message : (language === "fr" ? "Erreur de paiement express." : "Express payment error."));
      setSubmitting(false);
    }
  }

  return <div className={`embedded-payment-v242 ${submitting ? "is-processing-v406" : ""}`} aria-busy={submitting}>
    <div className="embedded-payment-heading-v242">
      <div>
        <p className="checkout-step-kicker">04 · {language === "fr" ? "PAIEMENT" : "PAYMENT"}</p>
        <h2>{language === "fr" ? "Paiement sécurisé" : "Secure payment"}</h2>
        <p>{language === "fr"
          ? "Payez ici sans quitter Ichigo Ichie. Stripe protège les données de votre carte."
          : "Pay here without leaving Ichigo Ichie. Stripe protects your card details."}</p>
      </div>
      <span className="embedded-payment-order-v242">{orderNumber}</span>
    </div>

    <div className={`embedded-express-v242 ${expressVisible ? "is-visible" : ""}`} aria-hidden={!expressVisible}>
      <p>{language === "fr" ? "Paiement express" : "Express payment"}</p>
      <ExpressCheckoutElement
        onReady={(event) => setExpressVisible(Boolean(event.availablePaymentMethods))}
        onConfirm={confirmExpressPayment}
      />
    </div>

    {expressVisible && <div className="embedded-payment-divider-v242"><span>{language === "fr" ? "ou" : "or"}</span></div>}

    <div className="embedded-payment-element-v242">
      <PaymentElement options={{ layout: "accordion" }} />
    </div>

    {submitting && <div id="payment-processing-v406" className="payment-processing-v406" role="status" aria-live="polite">
      <span className="payment-processing-spinner-v406" aria-hidden="true" />
      <div>
        <strong>{language === "fr" ? "Validation sécurisée en cours" : "Secure payment confirmation in progress"}</strong>
        <small>{language === "fr"
          ? "Gardez cette page ouverte et suivez les éventuelles instructions Stripe. Vous serez redirigé dès que la confirmation est terminée."
          : "Keep this page open and follow any Stripe instructions. You will be redirected as soon as confirmation is complete."}</small>
      </div>
    </div>}

    {paymentError && <div className="embedded-payment-error-v242" role="alert">{paymentError}</div>}

    <button
      type="button"
      className="button primary full embedded-pay-button-v242"
      disabled={submitting}
      aria-describedby={submitting ? "payment-processing-v406" : undefined}
      onClick={confirmStandardPayment}
    >
      {submitting
        ? (language === "fr" ? "Validation du paiement…" : "Confirming payment…")
        : `${language === "fr" ? "Payer maintenant" : "Pay now"} · ${formatMoney(total, language)}`}
    </button>

    <div className="embedded-payment-trust-v242">
      <span>🔒 Stripe</span>
      <span>3D Secure</span>
      <span>{language === "fr" ? "Données bancaires chiffrées" : "Encrypted payment details"}</span>
    </div>

    <div className={`mobile-embedded-paybar-v242 ${submitting ? "is-processing-v406" : ""}`}>
      <div>
        <small>{submitting ? (language === "fr" ? "Paiement en cours" : "Payment processing") : "Total"}</small>
        <strong>{formatMoney(total, language)}</strong>
      </div>
      <button
        type="button"
        className="button primary"
        disabled={submitting}
        aria-describedby={submitting ? "payment-processing-v406" : undefined}
        onClick={confirmStandardPayment}
      >
        {submitting ? (language === "fr" ? "Validation…" : "Processing…") : (language === "fr" ? "Payer" : "Pay")}
      </button>
    </div>
  </div>;
}

export default function EmbeddedStripePayment(props: EmbeddedStripePaymentProps) {
  const options = useMemo(() => ({
    clientSecret: props.clientSecret,
    elementsOptions: {
      appearance: {
        theme: "stripe" as const,
        inputs: "spaced" as const,
        labels: "above" as const,
        variables: {
          colorPrimary: "#244c3d",
          colorBackground: "#fffdfa",
          colorText: "#20392f",
          colorDanger: "#a64232",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSizeBase: "16px",
          spacingUnit: "4px",
          borderRadius: "14px",
        },
        rules: {
          ".Input": { border: "1px solid #d9ded5", boxShadow: "none" },
          ".Input:focus": { borderColor: "#244c3d", boxShadow: "0 0 0 1px #244c3d" },
          ".Tab": { border: "1px solid #d9ded5", boxShadow: "none" },
          ".Tab--selected": { borderColor: "#244c3d", boxShadow: "0 0 0 1px #244c3d" },
        },
      },
    },
  }), [props.clientSecret]);

  if (!publishableKey) {
    return <div className="embedded-payment-error-v242" role="alert">
      {props.language === "fr"
        ? "Paiement intégré non configuré : ajoutez NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans .env.local."
        : "Embedded payment is not configured: add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local."}
    </div>;
  }

  return <CheckoutElementsProvider stripe={stripePromise} options={options}>
    <PaymentContents total={props.total} language={props.language} orderNumber={props.orderNumber} />
  </CheckoutElementsProvider>;
}
