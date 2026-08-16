import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const tracker = readFileSync(
  resolve(root, "src/components/OrderTracker.tsx"),
  "utf8",
);
const payment = readFileSync(
  resolve(root, "src/components/EmbeddedStripePayment.tsx"),
  "utf8",
);
const e2e = readFileSync(
  resolve(root, "tests/e2e/order-payment-actions.spec.ts"),
  "utf8",
);

test("V434 records payment-confirmation intent before both Stripe confirm paths", () => {
  assert.match(payment, /PAYMENT_CONFIRMATION_MARKER_PREFIX = "ichigo:payment-confirming:"/);
  assert.match(payment, /markPaymentConfirmationStarted\(orderNumber\)/);
  assert.match(payment, /const result = await checkout\.confirm\(\)/);
  assert.match(payment, /expressCheckoutConfirmEvent: event/);
});

test("Stripe errors clear the temporary marker instead of locking recovery", () => {
  assert.match(payment, /clearPaymentConfirmationMarker\(orderNumber\)/);
  assert.match(payment, /result\.type === "error"/);
  assert.match(payment, /setPaymentError/);
});

test("tracking accepts the marker only for a fresh pending online payment", () => {
  assert.match(tracker, /PAYMENT_CONFIRMATION_MARKER_TTL_MS = 2 \* 60_000/);
  assert.match(tracker, /readFreshPaymentConfirmationMarker/);
  assert.match(tracker, /data\.payment_method === "online"/);
  assert.match(tracker, /\["pending", "unpaid"\]\.includes\(data\.payment_status\)/);
  assert.match(tracker, /setPaymentSubmissionGuard\(true\)/);
});

test("successful Stripe return never reopens duplicate actions on a fixed timer", () => {
  assert.match(
    tracker,
    /const paymentSyncRequested = paymentReturn === "success" \|\| paymentSubmissionGuard/,
  );
  assert.match(
    tracker,
    /const paymentAwaitingConfirmation =[\s\S]*\["pending", "unpaid"\]\.includes\(order\.payment_status\)/,
  );
  assert.match(
    tracker,
    /paymentSyncRequested && Boolean\(paymentAwaitingConfirmation\)/,
  );
  assert.doesNotMatch(tracker, /PAYMENT_CONFIRMATION_GRACE_MS/);
  assert.doesNotMatch(tracker, /setPaymentSyncGraceExpired/);
});

test("failed and expired backend states naturally restore the existing recovery actions", () => {
  assert.match(
    tracker,
    /const paymentNeedsAction = onlinePayment && \["pending", "unpaid", "failed", "expired"\]\.includes\(order\.payment_status\)/,
  );
  assert.match(
    tracker,
    /paymentNeedsAction && !paymentSyncPending && !isStopped && !retryPaymentSession/,
  );
  assert.match(
    tracker,
    /const paymentSyncPending = paymentSyncRefreshing[\s\S]*\["pending", "unpaid"\]\.includes\(order\.payment_status\)/,
  );
});

test("browser regression locks the exact no-double-payment customer experience", () => {
  assert.match(e2e, /fresh Stripe confirmation hides duplicate pay and cancel actions/);
  assert.match(e2e, /sessionStorage\.setItem/);
  assert.match(e2e, /confirmation stripe en cours\|stripe confirmation in progress/i);
  assert.match(e2e, /payer maintenant\|pay now/i);
  assert.match(e2e, /annuler la commande\|cancel order/i);
});
