import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const payment = readFileSync(resolve(root, "src/components/EmbeddedStripePayment.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-03.css"), "utf8");

test("Stripe confirmation exposes one persistent processing state until redirect or error", () => {
  assert.match(payment, /setSubmitting\(true\);[\s\S]*setPaymentError\(""\)/);
  assert.match(payment, /if \(result\.type === "error"\)[\s\S]*setSubmitting\(false\)/);
  assert.match(payment, /On success Stripe completes the flow[\s\S]*Keep the button disabled while that transition occurs/);
  assert.match(payment, /embedded-payment-v242 \$\{submitting \? "is-processing-v406" : ""\}/);
  assert.match(payment, /aria-busy=\{submitting\}/);
});

test("payment processing status tells customers to keep the page open and remains accessible", () => {
  assert.match(payment, /id="payment-processing-v406"/);
  assert.match(payment, /role="status"/);
  assert.match(payment, /aria-live="polite"/);
  assert.match(payment, /Validation sécurisée en cours/);
  assert.match(payment, /Gardez cette page ouverte/);
  assert.match(payment, /Keep this page open/);
  assert.match(payment, /aria-describedby=\{submitting \? "payment-processing-v406" : undefined\}/);
});

test("mobile Stripe paybar replaces ambiguous ellipsis with explicit processing feedback", () => {
  assert.match(payment, /mobile-embedded-paybar-v242 \$\{submitting \? "is-processing-v406" : ""\}/);
  assert.match(payment, /Paiement en cours/);
  assert.match(payment, /Payment processing/);
  assert.match(payment, /Validation…/);
  assert.match(payment, /Processing…/);
  assert.match(css, /Ichigo Ichie V4\.06 — Stripe payment processing feedback/);
  assert.match(css, /payment-processing-spinner-v406/);
  assert.match(css, /prefers-reduced-motion/);
});
