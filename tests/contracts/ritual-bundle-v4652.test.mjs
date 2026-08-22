import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const settings = src("src/lib/settings.ts");
const bundle = src("src/lib/bundle.ts");
const builder = src("src/components/RitualBundleBuilder.tsx");
const admin = src("src/components/admin/AdminSettings.tsx");
const cart = src("src/components/CartPageClient.tsx");
const checkout = src("src/app/checkout/page.tsx");
const calculation = src("src/lib/order-calculation.ts");

test("V465.2 gives admin mode and configurable discount", () => {
  assert.match(settings, /shop_ritual_bundle_mode: "matcha_accessory"/);
  assert.match(settings, /shop_ritual_bundle_discount_percent: "5"/);
  assert.match(admin, /value="two_matcha">2 matchas/);
  assert.match(admin, /shop_ritual_bundle_discount_percent/);
  assert.match(admin, /max="50"/);
  assert.match(admin, /step="0\.5"/);
});

test("V465.2 clamps discount and keeps five percent fallback", () => {
  assert.match(bundle, /RITUAL_BUNDLE_RATE = 0\.05/);
  assert.match(bundle, /MAX_RITUAL_BUNDLE_PERCENT = 50/);
  assert.match(bundle, /ritualBundlePercentFromSetting/);
  assert.match(bundle, /Math\.max\(0/);
});

test("V465.2 storefront supports both compositions", () => {
  assert.match(builder, /mode === "two_matcha" \? matchas : accessories/);
  assert.match(builder, /2 matchas · −/);
  assert.match(builder, /Matcha \+ accessoire · −5 %/);
  assert.match(builder, /product\.type === "product"/);
  assert.match(builder, /product\.type === "accessory"/);
});

test("V465.2 identical matchas remain two distinct lines", () => {
  assert.match(bundle, /slot\?: "a" \| "b"/);
  assert.match(bundle, /:slot:\$\{slot\}/);
  assert.match(builder, /addBundleLine\(firstProduct, firstVariant, "a"\)/);
  assert.match(builder, /addBundleLine\(secondProduct, secondVariant, "b"\)/);
  assert.match(builder, /requiredByStockUnit/);
});

test("V465.2 cart and checkout preview configured percentage", () => {
  assert.match(cart, /ritualBundlePercentFromSetting/);
  assert.match(cart, /cartBundleDiscount\(items, ritualBundleRate\)/);
  assert.match(checkout, /ritualBundleModeFromSetting/);
  assert.match(checkout, /cartBundleDiscount\(items, ritualBundleRate\)/);
  assert.match(checkout, /ritualBundleSummaryLabel/);
});

test("V465.2 server reads settings and validates composition", () => {
  assert.match(calculation, /\.from\("site_settings"\)/);
  assert.match(calculation, /shop_ritual_bundle_mode/);
  assert.match(calculation, /shop_ritual_bundle_discount_percent/);
  assert.match(calculation, /mode === "two_matcha"/);
  assert.match(calculation, /rows\.every\(\(row\) => row\.product_type === "product"\)/);
  assert.match(calculation, /roles\.has\("accessory"\)/);
  assert.match(calculation, /bundleRate/);
  assert.match(calculation, /requestedByStockUnit/);
  assert.match(calculation, /requested > available/);
});
