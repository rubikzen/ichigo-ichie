import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-03.css"), "utf8");

test("checkout explains every custom condition that can keep payment disabled", () => {
  assert.match(checkout, /const submitDisabled = loading \|\| underMinimumOnlinePayment \|\| !acceptedTerms \|\| \(orderType === "shipping" && \(quoteLoading \|\| !selectedShipping \|\| !shippingAddressReady\)\);/);
  assert.match(checkout, /underMinimumOnlinePayment[\s\S]*minimumPaymentMessage\(language\)/);
  assert.match(checkout, /const checkoutBlocker = loading \|\| paymentSession/);
  assert.match(checkout, /quoteLoading[\s\S]*Calcul de la livraison en cours/);
  assert.match(checkout, /quoteError[\s\S]*tarif de livraison doit être disponible/);
  assert.match(checkout, /!shippingAddressReady[\s\S]*Complétez l’adresse de livraison/);
  assert.match(checkout, /!selectedShipping[\s\S]*Choisissez un mode de livraison/);
  assert.match(checkout, /!acceptedTerms[\s\S]*Acceptez les CGV/);
});

test("desktop payment CTA exposes its blocker through accessible description", () => {
  assert.match(checkout, /id="checkout-blocker-v405"[\s\S]*role="status"[\s\S]*aria-live="polite"/);
  assert.match(checkout, /aria-describedby=\{checkoutBlocker \? "checkout-blocker-v405 checkout-disclaimer-v405" : "checkout-disclaimer-v405"\}/);
  assert.match(checkout, /id="checkout-disclaimer-v405" className="checkout-disclaimer"/);
  assert.match(css, /Ichigo Ichie V4\.05 — Checkout readiness feedback/);
  assert.match(css, /\.checkout-blocker-v405 \{/);
});

test("mobile sticky payment bar surfaces the same blocker without covering content", () => {
  assert.match(checkout, /mobile-checkout-paybar-v236 \$\{checkoutBlocker \? "has-blocker-v405" : ""\}/);
  assert.match(checkout, /aria-describedby=\{checkoutBlocker \? "mobile-checkout-blocker-v405" : undefined\}/);
  assert.match(checkout, /id="mobile-checkout-blocker-v405"[\s\S]*\{checkoutBlocker\}/);
  assert.match(css, /\.mobile-checkout-blocker-v405[\s\S]*grid-column: 1 \/ -1/);
  assert.match(css, /padding-bottom: calc\(150px \+ env\(safe-area-inset-bottom, 0px\)\) !important/);
});
