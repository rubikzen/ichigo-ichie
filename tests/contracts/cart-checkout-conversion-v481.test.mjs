import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const cart = src("src/components/CartPageClient.tsx");
const checkout = src("src/app/checkout/page.tsx");
const css = src("src/app/styles/globals-04.css");

const marker = "/* V481 — Cart & checkout conversion polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V481 CSS marker must exist");
const v481 = css.slice(start);

test("V481 marks cart and checkout conversion surfaces without replacing their existing versions", () => {
  assert.match(cart, /cart-page cart-page-v216 cart-page-v481/);
  assert.match(cart, /data-cart-conversion-v481/);
  assert.match(checkout, /checkout-page checkout-page-v460 checkout-page-v481/);
  assert.match(checkout, /data-checkout-conversion-v481/);
});

test("V481 keeps cart total and stock guard as the mobile primary action", () => {
  assert.match(cart, /mobile-cart-checkout-bar-v419[\s\S]*?mobile-cart-checkout-bar-v481/);
  assert.match(cart, /mobile-cart-total-v419 mobile-cart-total-v481/);
  assert.match(cart, /mobile-cart-checkout-v419 mobile-cart-checkout-v481/);
  assert.match(cart, /aria-disabled=\{hasStockConflict\}/);
  assert.match(cart, /if \(hasStockConflict\) event\.preventDefault\(\)/);
  assert.match(cart, /href="\/checkout"/);
});

test("V481 gives checkout an immediate mobile total and fulfilment context", () => {
  assert.match(checkout, /checkout-mobile-overview-v481/);
  assert.match(checkout, /money\.format\(checkoutTotal\)/);
  assert.match(checkout, /orderType === "shipping"/);
  assert.match(checkout, /Livraison suivie en France/);
  assert.match(checkout, /Retrait gratuit à Nice/);
  assert.match(checkout, /checkout-fulfilment-v481/);
});

test("V481 keeps the original checkout readiness blockers and terms gate", () => {
  assert.match(
    checkout,
    /const submitDisabled = loading \|\| underMinimumOnlinePayment \|\| !acceptedTerms \|\| \(orderType === "shipping" && \(quoteLoading \|\| !selectedShipping \|\| !shippingAddressReady\)\);/,
  );
  assert.match(checkout, /const checkoutBlocker = loading \|\| paymentSession/);
  assert.match(checkout, /checkout-terms-v227 checkout-terms-v481/);
  assert.match(checkout, /checked=\{acceptedTerms\}/);
  assert.match(checkout, /id="mobile-checkout-blocker-v405"/);
});

test("V481 keeps Stripe embedded payment and canonical order creation untouched", () => {
  assert.match(checkout, /<EmbeddedStripePayment/);
  assert.match(checkout, /checkoutSessionClientSecret/);
  assert.match(checkout, /fetch\("\/api\/orders"/);
  assert.match(checkout, /acceptedTerms: true/);
  assert.match(checkout, /items: cartPayload\(items\)/);
});

test("V481 makes desktop cart and checkout summaries sticky without moving commerce state", () => {
  assert.match(v481, /\.cart-summary-v481 \{[\s\S]*?position: sticky;[\s\S]*?top: 92px;/);
  assert.match(v481, /\.checkout-summary-v481 \{[\s\S]*?position: sticky;[\s\S]*?top: 92px;/);
  assert.match(v481, /\.cart-layout-v481 \{[\s\S]*?grid-template-columns:/);
  assert.match(v481, /\.checkout-layout-v481 \{[\s\S]*?grid-template-columns:/);
});

test("V481 keeps both mobile conversion bars above the bottom navigation", () => {
  assert.match(
    v481,
    /\.mobile-cart-checkout-bar-v481 \{[\s\S]*?bottom: calc\(68px \+ env\(safe-area-inset-bottom, 0px\)\) !important;/,
  );
  assert.match(
    v481,
    /\.mobile-checkout-paybar-v481 \{[\s\S]*?bottom: calc\(68px \+ env\(safe-area-inset-bottom, 0px\)\) !important;/,
  );
  assert.match(v481, /\.cart-page-v481 \{[\s\S]*?190px \+ env\(safe-area-inset-bottom, 0px\)/);
  assert.match(v481, /\.checkout-page-v481 \{[\s\S]*?205px \+ env\(safe-area-inset-bottom, 0px\)/);
});

test("V481 makes fulfilment the first strong checkout choice while preserving shipping and pickup", () => {
  assert.match(checkout, /checkout-fulfilment-v481/);
  assert.match(checkout, /name="orderType" value="shipping"/);
  assert.match(checkout, /name="orderType" value="pickup"/);
  assert.match(v481, /\.checkout-fulfilment-v481 \{[\s\S]*?background: linear-gradient/);
  assert.match(v481, /\.checkout-page-v481 \.pickup-choice\.active/);
});

test("V481 keeps mobile controls touch-safe and removes no trust or edit affordances", () => {
  assert.match(v481, /\.mobile-cart-checkout-v481 \{[\s\S]*?min-height: 48px !important;/);
  assert.match(v481, /\.mobile-checkout-paybar-v481 \.button \{[\s\S]*?min-height: 50px !important;/);
  assert.match(cart, /cart-trust-v460/);
  assert.match(checkout, /checkout-trust-strip-v460 checkout-trust-strip-v481/);
  assert.match(checkout, /checkout-summary-head-v460/);
  assert.match(checkout, /href="\/panier"/);
});

test("V481 is presentation-only with no pricing stock database or schema mutation", () => {
  assert.doesNotMatch(v481, /supabase|\/api\/orders|stripe|order_items|create table|alter table/i);
  assert.match(cart, /const ritualSubtotal = Math\.max/);
  assert.match(checkout, /const shippingFee = orderType === "shipping"/);
  assert.match(checkout, /const discountAmount =/);
  assert.doesNotMatch(cart, /suppressHydrationWarning/);
  assert.doesNotMatch(checkout, /suppressHydrationWarning/);
});
