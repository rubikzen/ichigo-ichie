import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const route = source("src/app/api/admin/commerce-recovery/route.ts");
const health = source("src/lib/commerce-health.ts");
const ui = source("src/components/ProductionAdmin.tsx");

test("commerce recovery is admin-only and confirmation-gated", () => {
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /confirmation !== "LIBERER"/);
  assert.match(route, /confirmation !== "FINALISER PROMO"/);
  assert.match(route, /confirmation !== "SYNC PROMO"/);
});

test("reservation release never runs for processed payments or protected fulfilment", () => {
  for (const state of ["paid", "refunded", "refund_pending", "refund_failed"]) {
    assert.ok(route.includes(`"${state}"`), `missing protected payment ${state}`);
  }
  for (const state of ["preparing", "ready", "completed", "refunded"]) {
    assert.ok(route.includes(`"${state}"`), `missing protected status ${state}`);
  }
  assert.match(route, /processedPayment\(order\.payment_status\)/);
  assert.match(route, /PROTECTED_FULFILMENT_STATES\.has/);
});

test("Stripe is secured before stock or promo release", () => {
  const retrieve = route.indexOf("stripe.checkout.sessions.retrieve");
  const expire = route.indexOf("stripe.checkout.sessions.expire");
  const stock = route.indexOf('"release_shop_order_stock"');
  const promo = route.indexOf('"release_order_promo"');

  assert.notEqual(retrieve, -1);
  assert.notEqual(expire, -1);
  assert.notEqual(stock, -1);
  assert.notEqual(promo, -1);
  assert.ok(retrieve < stock);
  assert.ok(expire < stock);
  assert.ok(stock < promo);
  assert.match(route, /markStripeOrderPaid/);
});

test("active payment windows are rejected and stale pending orders become expired first", () => {
  assert.match(route, /orderIsRecoverable\(order\)/);
  assert.match(route, /La fenêtre de paiement est encore active/);
  assert.match(route, /payment_status: "expired"/);
  assert.match(route, /\.in\("payment_status", \["pending", "unpaid"\]\)/);
});

test("paid promo recovery commits the promo without releasing stock", () => {
  const commitBlockStart = route.indexOf('if (action === "commit_paid_promo")');
  const releaseBlockStart = route.indexOf('if (confirmation !== "LIBERER")');

  assert.notEqual(commitBlockStart, -1);
  assert.notEqual(releaseBlockStart, -1);

  const commitBlock = route.slice(commitBlockStart, releaseBlockStart);
  assert.match(commitBlock, /commit_order_promo/);
  assert.doesNotMatch(commitBlock, /release_shop_order_stock/);
  assert.doesNotMatch(commitBlock, /release_order_promo/);
});

test("promo counter sync uses real reserved orders and guards usage limit", () => {
  assert.match(route, /\.eq\("promo_code_id", promoId\)/);
  assert.match(route, /\.eq\("promo_reserved", true\)/);
  assert.match(route, /usedCount \+ actualReserved > usageLimit/);
  assert.match(route, /\.update\(\{ reserved_count: actualReserved \}\)/);
});

test("health model suggests only guarded recovery actions", () => {
  assert.match(health, /recoveryAction: "release_order_reservations" \| "commit_paid_promo" \| null/);
  assert.match(health, /promoLeak && moneyAlreadyProcessed/);
  assert.match(health, /!moneyAlreadyProcessed/);
  assert.match(health, /protectedFulfilment/);
});

test("admin exposes recovery controls and refreshes diagnostics after actions", () => {
  assert.match(ui, /commerceRecovery\(/);
  assert.match(ui, /\/api\/admin\/commerce-recovery/);
  assert.match(ui, /issue\.recoveryLabel/);
  assert.match(ui, /commit_paid_promo/);
  assert.match(ui, /Synchroniser/);
  assert.match(ui, /confirmation explicite/);
  assert.match(ui, /await refresh\(\)/);
});
