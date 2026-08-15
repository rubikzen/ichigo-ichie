import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const tracker = readFileSync(resolve(root, "src/components/OrderTracker.tsx"), "utf8");
const e2e = readFileSync(resolve(root, "tests/e2e/order-payment-actions.spec.ts"), "utf8");

test("cancelled Stripe return has an explicit non-success title", () => {
  assert.match(tracker, /paymentTitle\(order, language, paymentReturn\)/);
  assert.match(tracker, /paymentReturn === "cancelled" && \["pending", "unpaid"\]\.includes\(order\.payment_status\)/);
  assert.match(tracker, /Paiement interrompu/);
  assert.match(tracker, /Payment interrupted/);
});

test("payment recovery action labels distinguish pending failed and expired states", () => {
  assert.match(tracker, /\["pending", "unpaid"\]\.includes\(order\.payment_status\)[\s\S]*Payer maintenant/);
  assert.match(tracker, /order\.payment_status === "expired"[\s\S]*Créer une nouvelle session/);
  assert.match(tracker, /Réessayer le paiement/);
});

test("expired recovery explicitly keeps the customer on the existing order", () => {
  assert.match(tracker, /inutile de refaire votre panier ou de créer une autre commande/);
  assert.match(tracker, /no need to rebuild your cart or create another order/);
  assert.match(tracker, /fetch\("\/api\/stripe\/retry"/);
  assert.doesNotMatch(tracker, /fetch\("\/api\/orders", \{ method: "POST"/);
});

test("E2E covers cancelled failed and expired recovery without duplicate order creation", () => {
  assert.match(e2e, /payment cancelled return is explicit and keeps recovery on the same order/);
  assert.match(e2e, /failed payment retries the same order without creating a duplicate order/);
  assert.match(e2e, /expired payment creates a new session for the existing order only/);
  assert.match(e2e, /request\.method\(\) === "POST" && url\.pathname === "\/api\/orders"/);
  assert.match(e2e, /expect\(getCreateOrderCalls\(\)\)\.toBe\(0\)/);
});
