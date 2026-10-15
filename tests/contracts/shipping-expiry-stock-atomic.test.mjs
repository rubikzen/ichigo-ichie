import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const stripe = readFileSync(resolve(root, "src/lib/stripe.ts"), "utf8");
const sql = readFileSync(resolve(root, "supabase/migrations/20261016003000_atomic_shipping_checkout_expiry.sql"), "utf8");
const webhook = readFileSync(resolve(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
const sync = readFileSync(resolve(root, "src/app/api/stripe/sync/route.ts"), "utf8");
const recovery = readFileSync(resolve(root, "src/app/api/admin/commerce-recovery/route.ts"), "utf8");

test("shipping checkout expiry uses one transactional RPC, leaving pickup logic unchanged", () => {
  assert.match(stripe, /if \(order\.order_type === "shipping"\)/);
  assert.match(stripe, /supabase\.rpc\("finalize_shipping_checkout_unpaid"/);
  assert.match(stripe, /p_session_id: session\.id/);
  assert.match(stripe, /p_new_payment_status: status/);
  assert.match(stripe, /if \(finalizeError\) throw finalizeError/);
  assert.match(stripe, /await supabase\.rpc\("release_shop_order_stock"/);
});

test("atomic function locks matching shipping Checkout Session and protects paid orders", () => {
  assert.match(sql, /for update;/i);
  assert.match(sql, /v_order\.order_type is distinct from 'shipping'/);
  assert.match(sql, /v_order\.stripe_checkout_session_id is distinct from p_session_id/);
  assert.match(sql, /v_order\.payment_status not in \('pending', 'unpaid', 'failed', 'expired'\)/);
  assert.match(sql, /perform public\.release_shop_order_stock\(p_order_id\);/);
  assert.match(sql, /perform public\.release_order_promo\(p_order_id\);/);
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/i);
  assert.match(sql, /grant execute .* to service_role/i);
});

test("webhook replay and customer return sync reach the same shipping expiry helper", () => {
  assert.match(webhook, /markStripeOrderUnpaid\(supabase, event\.data\.object as Stripe\.Checkout\.Session, "expired"\)/);
  assert.match(sync, /markStripeOrderUnpaid\(supabase, session, "expired"\)/);
});

test("manual admin recovery also uses the atomic shipping expiry transaction", () => {
  assert.match(recovery, /order\.order_type === "shipping"/);
  assert.match(recovery, /supabase\.rpc\(\s*"finalize_shipping_checkout_unpaid"/);
  assert.match(recovery, /p_new_payment_status: "expired"/);
  assert.match(recovery, /latest\.stock_reserved \|\| latest\.promo_reserved/);
});

test("shipping checkout retries recheck stock after attaching a new session", () => {
  const attach = stripe.indexOf('const { data: attachedOrder, error: updateError }');
  const reserve = stripe.indexOf('await supabase.rpc("reserve_shop_order_stock", { p_order_id: order.id })', attach);
  const returnSecret = stripe.indexOf('clientSecret: session.client_secret', attach);
  assert.ok(attach > 0 && reserve > attach && returnSecret > reserve);
  assert.match(stripe, /\.in\("payment_status", \[\.\.\.PAYMENT_UNPAID_SOURCE_STATES\]\)/);
  assert.match(stripe, /attachment\.eq\("stripe_checkout_session_id", order\.stripe_checkout_session_id\)/);
  assert.match(stripe, /if \(finalStockError\)/);
  assert.match(stripe, /await stripe\.checkout\.sessions\.expire\(session\.id\)/);
});

test("closed or refunded orders cannot reserve additional stock", () => {
  const guard = stripe.indexOf('if (order.status === "cancelled" || order.status === "refunded"');
  const reserve = stripe.indexOf('await supabase.rpc("reserve_shop_order_stock", { p_order_id: order.id })');
  assert.ok(guard !== -1 && reserve > guard);
});
