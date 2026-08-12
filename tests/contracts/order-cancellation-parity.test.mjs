import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const helper = source("src/lib/order-cancellation.ts");
const publicRoute = source("src/app/api/orders/[token]/cancel/route.ts");
const adminRoute = source("src/app/api/admin/orders/[id]/route.ts");
const adminUi = source("src/components/admin/AdminOrders.tsx");

test("customer and admin cancellation use one shared backend helper", () => {
  assert.match(publicRoute, /cancelUnpaidOrder/);
  assert.match(publicRoute, /actor: "customer"/);
  assert.match(adminRoute, /cancelUnpaidOrder/);
  assert.match(adminRoute, /actor: "admin"/);
});

test("shared cancellation secures Stripe before releasing reservations", () => {
  const retrieveIndex = helper.indexOf("stripe.checkout.sessions.retrieve");
  const expireIndex = helper.indexOf("stripe.checkout.sessions.expire");
  const transitionIndex = helper.indexOf(".update({", expireIndex);
  const stockIndex = helper.indexOf('"release_shop_order_stock"');
  const promoIndex = helper.indexOf('"release_order_promo"');

  assert.notEqual(retrieveIndex, -1);
  assert.notEqual(expireIndex, -1);
  assert.notEqual(transitionIndex, -1);
  assert.notEqual(stockIndex, -1);
  assert.notEqual(promoIndex, -1);
  assert.match(
    helper.slice(transitionIndex, transitionIndex + 220),
    /status: "cancelled"/,
  );
  assert.ok(retrieveIndex < transitionIndex);
  assert.ok(expireIndex < transitionIndex);
  assert.ok(transitionIndex < stockIndex);
  assert.ok(stockIndex < promoIndex);
});

test("shared cancellation blocks paid and refund states including refund_failed", () => {
  for (const state of ["paid", "refunded", "refund_pending", "refund_failed"]) {
    assert.ok(helper.includes(`"${state}"`), `missing protected state ${state}`);
  }
  assert.match(helper, /markStripeOrderPaid/);
  assert.match(helper, /session\.status === "complete"/);
});

test("database cancellation transition remains race-safe and retryable", () => {
  assert.match(helper, /\.eq\("status", "pending"\)/);
  assert.match(
    helper,
    /\.in\("payment_status", \["pending", "unpaid", "failed", "expired"\]\)/,
  );
  assert.match(helper, /latestReservationState\.stock_reserved/);
  assert.match(helper, /latestReservationState\.promo_reserved/);
  assert.match(helper, /cancelledNow/);
});

test("cancellation email is sent only after stock and promo cleanup logic", () => {
  const stockIndex = helper.indexOf('"release_shop_order_stock"');
  const promoIndex = helper.indexOf('"release_order_promo"');
  const emailIndex = helper.indexOf(
    'sendOrderEmail(supabase, order.id, "cancellation")',
  );

  assert.ok(stockIndex < promoIndex);
  assert.ok(promoIndex < emailIndex);
});

test("admin reloads a partially-cancelled order when cleanup reports an error", () => {
  assert.match(adminUi, /status === "cancelled" && data\.cancelled === true/);
  assert.match(adminUi, /Commande annulée ✓ · réservations libérées/);
});
