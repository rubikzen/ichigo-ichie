import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const syncRoute = src("src/app/api/stripe/sync/route.ts");
const tracker = src("src/components/OrderTracker.tsx");
const stripe = src("src/lib/stripe.ts");
const e2e = src("tests/e2e/order-payment-actions.spec.ts");

test("V436 exposes a narrowly scoped Stripe return reconciliation endpoint", () => {
  assert.match(syncRoute, /scope: "stripe:return-sync"/);
  assert.match(syncRoute, /limit: 40/);
  assert.match(syncRoute, /UUID_RE/);
  assert.match(syncRoute, /CHECKOUT_SESSION_RE/);
  assert.match(syncRoute, /Cache-Control": "no-store"/);
});

test("reconciliation uses the returned session id or the order current stored session", () => {
  assert.match(syncRoute, /requestedSessionId \|\| String\(order\.stripe_checkout_session_id \|\| ""\)\.trim\(\)/);
  assert.match(syncRoute, /stripe\.checkout\.sessions\.retrieve\(sessionId\)/);
});

test("a public tracking token can never reconcile an unrelated Stripe Session", () => {
  assert.match(syncRoute, /session\.metadata\?\.order_id !== order\.id/);
  assert.match(syncRoute, /Session de paiement incompatible avec cette commande/);
});

test("Stripe paid truth reuses the existing canonical paid-order pipeline", () => {
  assert.match(syncRoute, /session\.payment_status === "paid"/);
  assert.match(syncRoute, /await markStripeOrderPaid\(supabase, session\)/);
  assert.doesNotMatch(syncRoute, /payment_status:\s*"paid"/);
});

test("missed expiry webhooks self-heal only for the currently attached session", () => {
  assert.match(syncRoute, /session\.status === "expired"/);
  assert.match(syncRoute, /session\.id === order\.stripe_checkout_session_id/);
  assert.match(syncRoute, /await markStripeOrderUnpaid\(supabase, session, "expired"\)/);
});

test("paid DB transition errors are no longer silently swallowed", () => {
  assert.match(stripe, /const \{ error: paidUpdateError \} = await supabase/);
  assert.match(stripe, /if \(paidUpdateError\) throw paidUpdateError/);
});

test("tracker preserves Stripe return session id before cleaning the browser URL", () => {
  assert.match(tracker, /params\.get\("session_id"\)/);
  assert.match(tracker, /setPaymentReturnSessionId\(sessionId\)/);
  assert.match(tracker, /window\.history\.replaceState/);
});

test("tracker actively reconciles pending payments while keeping normal polling", () => {
  assert.match(tracker, /fetch\("\/api\/stripe\/sync"/);
  assert.match(tracker, /stripeSyncLastAttempt/);
  assert.match(tracker, /15_000/);
  assert.match(tracker, /if \(await reconcileStripeIfNeeded\(data\)\)/);
  assert.match(e2e, /successful Stripe return reconciles its Checkout Session before staying pending/);
});
