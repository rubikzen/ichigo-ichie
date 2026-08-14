import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const tracker = readFileSync(resolve(root, "src/components/OrderTracker.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-03.css"), "utf8");

test("successful Stripe return gets a bounded synchronization grace window", () => {
  assert.match(tracker, /const \[paymentSyncGraceExpired, setPaymentSyncGraceExpired\] = useState\(false\)/);
  assert.match(tracker, /paymentReturn === "success" && !paymentConfirmed && !paymentSyncGraceExpired/);
  assert.match(tracker, /window\.setTimeout\(\(\) => setPaymentSyncGraceExpired\(true\), 20_000\)/);
  assert.match(tracker, /return \(\) => window\.clearTimeout\(timer\)/);
});

test("order polling accelerates only during the Stripe synchronization window", () => {
  assert.match(tracker, /const orderRefreshIntervalMs = paymentSyncRefreshing \? 2000 : 5000/);
  assert.match(tracker, /window\.setInterval\(load, orderRefreshIntervalMs\)/);
  assert.match(tracker, /\[token, orderRefreshIntervalMs\]/);
});

test("pending webhook synchronization never offers duplicate pay or cancel actions immediately", () => {
  assert.match(tracker, /const paymentSyncPending = paymentSyncRefreshing[\s\S]*\["pending", "unpaid"\]\.includes\(order\.payment_status\)/);
  assert.match(tracker, /Confirmation Stripe en cours/);
  assert.match(tracker, /ne relancez pas le paiement pendant quelques secondes/);
  assert.match(tracker, /please do not retry payment for a few seconds/);
  assert.match(tracker, /paymentNeedsAction && !paymentSyncPending && !isStopped/);
  assert.match(tracker, /payment-sync-spinner-v407/);
  assert.match(css, /Ichigo Ichie V4\.07 — Stripe return synchronization/);
  assert.match(css, /prefers-reduced-motion/);
});

test("cart is still cleared only after backend payment confirmation", () => {
  assert.match(tracker, /if \(paymentReturn !== "success" \|\| !paymentConfirmed\) return/);
  assert.match(tracker, /cartClearedAfterPayment\.current = true/);
  assert.match(tracker, /clear\(\)/);
});
