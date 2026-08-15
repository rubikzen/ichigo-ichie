import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const account = readFileSync(resolve(root, "src/components/CustomerAccount.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("payment summary visibly prioritizes orders that require customer action", () => {
  assert.match(account, /customer-payment-summary-v410/);
  assert.match(account, /orderStats\.payment > 0 \? "has-attention-v410" : ""/);
  assert.match(account, /commande\(s\) nécessitant un paiement/);
  assert.match(account, /order\(s\) requiring payment/);
  assert.match(css, /customer-payment-summary-v410\.has-attention-v410:not\(\.active\)/);
});

test("recoverable payment cards expose one explicit attention state", () => {
  assert.match(account, /const paymentNeedsAttention = canRecoverPaymentStatus\(order\.payment_status\)/);
  assert.match(account, /paymentNeedsAttention \? "needs-payment-v410" : ""/);
  assert.match(account, /aria-label=\{`\$\{order\.order_number\} — \$\{orderBadgeLabel\(order, language\)\}`\}/);
  assert.match(css, /customer-order-card-v244\.needs-payment-v410/);
  assert.match(css, /customer-payment-recovery-hint-v409/);
});

test("customer order primary action is shared by payment recovery and tracking", () => {
  const matches = account.match(/customer-order-primary-action-v410/g) ?? [];
  assert.ok(matches.length >= 2);
  assert.match(account, /href=\{`\/commande\/\$\{order\.public_token\}\?payment=retry`\}/);
  assert.match(account, /href=\{`\/commande\/\$\{order\.public_token\}`\}/);
});

test("mobile order actions prioritize the main CTA and compact secondary actions", () => {
  assert.match(css, /Ichigo Ichie V4\.10 — Customer order action hierarchy/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /customer-order-primary-action-v410[\s\S]*grid-column: 1 \/ -1/);
  assert.match(css, /customer-order-primary-action-v410[\s\S]*order: -2/);
  assert.match(css, /\.button:not\(\.customer-order-primary-action-v410\)[\s\S]*white-space: normal/);
});
