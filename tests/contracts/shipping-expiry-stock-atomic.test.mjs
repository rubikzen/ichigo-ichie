import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const stripe = readFileSync(resolve(root, "src/lib/stripe.ts"), "utf8");
const sql = readFileSync(resolve(root, "supabase/migrations/20261016003000_atomic_shipping_checkout_expiry.sql"), "utf8");
const webhook = readFileSync(resolve(root, "src/app/api/stripe/webhook/route.ts"), "utf8");
const sync = readFileSync(resolve(root, "src/app/api/stripe/sync/route.ts"), "utf8");

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
