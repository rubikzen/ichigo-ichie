import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const account = readFileSync(resolve(root, "src/components/CustomerAccount.tsx"), "utf8");

test("customer account payment CTA matches V408 recovery semantics", () => {
  assert.match(account, /function customerPaymentActionLabel/);
  assert.match(account, /order\.payment_status === "expired"[\s\S]*Créer une nouvelle session/);
  assert.match(account, /order\.payment_status === "failed"[\s\S]*Réessayer le paiement/);
  assert.match(account, /return language === "fr" \? "Payer maintenant" : "Pay now"/);
  assert.match(account, /\{customerPaymentActionLabel\(order, language\)\}/);
});

test("customer account explains recovery without asking for a new order", () => {
  assert.match(account, /function customerPaymentRecoveryHint/);
  assert.match(account, /Reprenez cette commande sans en créer une nouvelle/);
  assert.match(account, /Retry this order without creating a new one/);
  assert.match(account, /Créez une nouvelle session pour cette même commande/);
  assert.match(account, /Create a new payment session for this same order/);
  assert.match(account, /customer-payment-recovery-hint-v409/);
});

test("customer account still routes every recoverable payment through the existing order", () => {
  assert.match(account, /href=\{`\/commande\/\$\{order\.public_token\}\?payment=retry`\}/);
  assert.match(account, /function canRecoverPaymentStatus/);
  assert.match(account, /\["pending", "unpaid", "failed", "expired"\]\.includes\(paymentStatus\)/);
  assert.doesNotMatch(account, /fetch\("\/api\/orders", \{ method: "POST"/);
});

test("refund failed orders are never exposed as cancellable unpaid orders", () => {
  assert.match(account, /!\["paid", "refunded", "refund_pending", "refund_failed"\]\.includes\(order\.payment_status\)/);
});
