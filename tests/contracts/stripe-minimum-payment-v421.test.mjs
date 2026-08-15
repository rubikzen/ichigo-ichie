import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const orders = readFileSync(resolve(root, "src/app/api/orders/route.ts"), "utf8");
const stripe = readFileSync(resolve(root, "src/lib/stripe.ts"), "utf8");
const retry = readFileSync(resolve(root, "src/app/api/stripe/retry/route.ts"), "utf8");
const readiness = readFileSync(resolve(root, "tests/contracts/checkout-readiness-v405.test.mjs"), "utf8");

test("payment layer rejects positive totals below one euro", () => {
  assert.match(stripe, /export const MINIMUM_ONLINE_PAYMENT_EUR_CENTS = 100/);
  assert.match(stripe, /export class MinimumOnlinePaymentError extends Error/);
  assert.match(stripe, /totalCents > 0 && totalCents < MINIMUM_ONLINE_PAYMENT_EUR_CENTS/);
  assert.match(stripe, /assertMinimumOnlinePayment\(Number\(order\.total \|\| 0\)\)/);
});

test("new orders stop below one euro before database insert while zero-total orders stay supported", () => {
  assert.match(
    orders,
    /const total = Math\.round\(\(discountedSubtotal \+ shippingFee\) \* 100\) \/ 100;[\s\S]*?assertMinimumOnlinePayment\(total\);[\s\S]*?getTermsVersion\(supabase\)[\s\S]*?from\("orders"\)\.insert/,
  );
  assert.match(orders, /if \(total <= 0\) \{[\s\S]*?payment_status: "paid"/);
  assert.match(orders, /error instanceof MinimumOnlinePaymentError[\s\S]*?1,00 €/);
});

test("checkout blocks a promo total between zero and one euro before posting an order", () => {
  assert.match(checkout, /const MIN_ONLINE_PAYMENT_EUR = 1;/);
  assert.match(checkout, /const underMinimumOnlinePayment = checkoutTotal > 0 && checkoutTotal < MIN_ONLINE_PAYMENT_EUR/);
  assert.match(checkout, /const submitDisabled = loading \|\| underMinimumOnlinePayment \|\| !acceptedTerms/);
  assert.match(
    checkout,
    /if \(underMinimumOnlinePayment\) \{[\s\S]*?setError\(minimumPaymentMessage\(language\)\);[\s\S]*?setErrorCode\("ORDER_PAYMENT_MINIMUM"\);[\s\S]*?return;/,
  );
});

test("minimum payment feedback is explicit in French and English", () => {
  assert.match(checkout, /montant minimum pour un paiement en ligne est de 1,00 €/);
  assert.match(checkout, /minimum amount for an online payment is €1\.00/);
  assert.match(checkout, /responseCode === "ORDER_PAYMENT_MINIMUM"[\s\S]*?minimumPaymentMessage\(language\)/);
  assert.match(readiness, /underMinimumOnlinePayment/);
});

test("payment retry uses the same one-euro guard for historical low-value orders", () => {
  assert.match(retry, /MinimumOnlinePaymentError/);
  assert.match(retry, /error instanceof MinimumOnlinePaymentError[\s\S]*?code: error\.code[\s\S]*?status: error\.status/);
  assert.match(stripe, /assertMinimumOnlinePayment\(Number\(order\.total \|\| 0\)\)/);
});
