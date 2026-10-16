import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

function source(path) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}
const orders = source("src/app/api/orders/route.ts");
const quote = source("src/app/api/shipping/quote/route.ts");
const retry = source("src/app/api/stripe/retry/route.ts");
const cancel = source("src/app/api/orders/[token]/cancel/route.ts");

test("invalid cart and non-JSON requests still produce actionable 4xx responses", () => {
  assert.match(orders, /const classified = classifyOrderError\(error\)/);
  assert.match(orders, /if \(classified\.status >= 500\) console\.error\("\[ORDER_ERROR\]"/);
  assert.match(orders, /error: classified\.message/);
  assert.match(orders, /status: classified\.status/);
  assert.match(quote, /if \(error instanceof OrderValidationError\)/);
  assert.match(quote, /error: error\.message, code: "SHIPPING_VALIDATION"/);
  assert.match(retry, /if \(error instanceof MinimumOnlinePaymentError\)/);
  assert.match(retry, /if \(publicError\)/);
});

test("shipping and Stripe retry never reveal unexpected backend exception messages", () => {
  assert.match(quote, /code: "SHIPPING_UNAVAILABLE"/);
  assert.match(retry, /code: "PAYMENT_RETRY_UNAVAILABLE"/);
  assert.match(quote, /status: 503, headers: \{ "Cache-Control": "no-store" \}/);
  assert.match(retry, /status: 503, headers: \{ "Cache-Control": "no-store" \}/);
  assert.doesNotMatch(quote, /error: error instanceof Error \? error\.message/);
  assert.doesNotMatch(retry, /error: error instanceof Error \? error\.message/);
});

test("cancellation internal failures do not expose Supabase or Stripe details", () => {
  assert.match(cancel, /code: "CANCELLATION_UNAVAILABLE"/);
  assert.match(cancel, /Impossible d’annuler cette commande pour le moment/);
  assert.doesNotMatch(cancel, /error: error instanceof Error \? error\.message/);
  assert.match(cancel, /cancelUnpaidOrder\(supabase, order\.id/);
});
