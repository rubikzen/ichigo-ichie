import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { checkoutFulfilmentModes, checkoutFulfilmentError } from "../../src/lib/checkout-fulfilment.ts";

const src = (path) => readFileSync(resolve(process.cwd(), path), "utf8");
const settings = src("src/lib/settings.ts");
const admin = src("src/components/admin/AdminSettings.tsx");
const checkout = src("src/app/checkout/page.tsx");
const cart = src("src/components/CartPageClient.tsx");
const orders = src("src/app/api/orders/route.ts");
const quote = src("src/app/api/shipping/quote/route.ts");
const retry = src("src/app/api/stripe/retry/route.ts");
const modeLib = src("src/lib/checkout-fulfilment.ts");

test("both modes are enabled by default and can be switched independently", () => {
  assert.deepEqual(checkoutFulfilmentModes({}), { pickupEnabled: true, shippingEnabled: true });
  assert.deepEqual(checkoutFulfilmentModes({ checkout_pickup_enabled: "false" }), { pickupEnabled: false, shippingEnabled: true });
  assert.deepEqual(checkoutFulfilmentModes({ checkout_shipping_enabled: "false" }), { pickupEnabled: true, shippingEnabled: false });
  assert.deepEqual(checkoutFulfilmentModes({ checkout_pickup_enabled: "false", checkout_shipping_enabled: "false" }), { pickupEnabled: false, shippingEnabled: false });
  assert.match(settings, /checkout_pickup_enabled: "true"/);
  assert.match(settings, /checkout_shipping_enabled: "true"/);
});

test("Admin exposes and saves both fulfilment switches under shipping settings", () => {
  assert.match(admin, /settingsPanel === "shipping"/);
  assert.match(admin, /toggle\("checkout_pickup_enabled"\)/);
  assert.match(admin, /toggle\("checkout_shipping_enabled"\)/);
  assert.match(admin, /site_settings"\)\.upsert\(rows\)/);
  assert.match(admin, /Les deux modes sont désactivés/);
});

test("checkout only renders eligible options and blocks when neither is available", () => {
  assert.match(checkout, /const canShip = shippingEnabled && !mustPickup/);
  assert.match(checkout, /const canPickup = pickupEnabled/);
  assert.match(checkout, /\{canShip && <label/);
  assert.match(checkout, /\{canPickup && <label/);
  assert.match(checkout, /const modeSubmitBlocked = Boolean\(unavailableMessage\)/);
  assert.match(checkout, /disabled=\{submitDisabled \|\| modeSubmitBlocked\}/);
  assert.match(checkout, /if \(unavailableMessage\)/);
});

test("cart prevents bypassing disabled modes, including pickup-only items", () => {
  assert.match(cart, /const checkoutUnavailable = !pickupEnabled && \(!shippingEnabled \|\| hasPickupOnly\)/);
  assert.match(cart, /aria-disabled=\{hasStockConflict \|\| checkoutUnavailable\}/);
  assert.match(cart, /if \(hasStockConflict \|\| checkoutUnavailable\) event\.preventDefault\(\)/);
});

test("both order creation and shipping quotes re-read live settings on the server", () => {
  assert.match(modeLib, /\.from\("site_settings"\)/);
  assert.match(modeLib, /\.in\("key", \["checkout_pickup_enabled", "checkout_shipping_enabled"\]\)/);
  assert.match(orders, /loadCheckoutFulfilmentModes\(supabase\)/);
  assert.match(orders, /checkoutFulfilmentError\(orderType, availableModes\)/);
  assert.match(quote, /loadCheckoutFulfilmentModes\(supabase\)/);
  assert.match(quote, /if \(!shippingEnabled\)/);
  assert.match(retry, /loadCheckoutFulfilmentModes\(supabase\)/);
  assert.match(retry, /checkoutFulfilmentError\(order\.order_type === "shipping"/);
  assert.match(orders, /throw new OrderValidationError\(fulfilmentError\)/);
  assert.equal(checkoutFulfilmentError("pickup", {pickupEnabled:false,shippingEnabled:true})?.includes("retrait boutique"), true);
  assert.equal(checkoutFulfilmentError("shipping", {pickupEnabled:true,shippingEnabled:false})?.includes("livraison"), true);
});
