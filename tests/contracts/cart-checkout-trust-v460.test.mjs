import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const cart = readFileSync(resolve(root, "src/components/CartPageClient.tsx"), "utf8");
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

const marker = "/* Ichigo Ichie V4.60 — Cart & checkout trust polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V460 CSS marker must exist");
const v460 = css.slice(start);

test("V460 adds compact bilingual trust reassurance to the cart summary", () => {
  assert.match(cart, /cart-trust-v460/);
  assert.match(cart, /Paiement sécurisé par Stripe/);
  assert.match(cart, /Secure Stripe payment/);
  assert.match(cart, /Retrait gratuit à Nice/);
  assert.match(cart, /Tracked delivery in France/);
});

test("V460 keeps the canonical cart stock blocker and checkout destination untouched", () => {
  assert.match(cart, /hasStockConflict/);
  assert.match(cart, /href="\/checkout"/);
  assert.match(cart, /if \(hasStockConflict\) event\.preventDefault\(\)/);
  assert.doesNotMatch(cart, /fetch\("\/api\/orders"/);
});

test("V460 gives checkout a clear reversible path back to the cart", () => {
  assert.match(checkout, /checkout-back-v460/);
  assert.match(checkout, /href="\/panier"/);
  assert.match(checkout, /Retour au panier/);
  assert.match(checkout, /Back to cart/);
});

test("V460 exposes payment delivery and pickup reassurance before the checkout form", () => {
  assert.match(checkout, /checkout-trust-strip-v460/);
  assert.match(checkout, /Stripe/);
  assert.match(checkout, /Suivie/);
  assert.match(checkout, /Tracked/);
  assert.match(checkout, /Retrait Nice/);
  assert.match(checkout, /Nice pickup/);
});

test("V460 lets customers edit the cart from the order summary without changing totals", () => {
  assert.match(checkout, /checkout-summary-head-v460/);
  assert.match(checkout, /Modifier/);
  assert.match(checkout, /Edit/);
  assert.match(checkout, /checkoutTotal/);
  assert.match(checkout, /shippingFee/);
  assert.match(checkout, /discountAmount/);
});

test("V460 explains Stripe charge timing without changing the existing payment pipeline", () => {
  assert.match(checkout, /checkout-summary-trust-v460/);
  assert.match(checkout, /Aucun débit avant l’ouverture du formulaire Stripe/);
  assert.match(checkout, /Nothing is charged before the Stripe payment form opens/);
  assert.match(checkout, /<EmbeddedStripePayment/);
  assert.match(checkout, /checkoutSessionClientSecret/);
});

test("V460 remains mobile safe around the existing fixed paybar and bottom dock", () => {
  assert.match(v460, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(v460, /@media \(max-width: 760px\)/);
  assert.match(v460, /@media \(max-width: 390px\)/);
  assert.match(checkout, /mobile-checkout-paybar-v236/);
});

test("V460 is presentation and reassurance only with no order pricing or schema mutation", () => {
  assert.doesNotMatch(checkout, /create table/i);
  assert.doesNotMatch(checkout, /alter table/i);
  assert.doesNotMatch(cart, /create table/i);
  assert.doesNotMatch(cart, /alter table/i);
});
