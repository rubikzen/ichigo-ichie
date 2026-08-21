import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const analytics = readFileSync(resolve(root, "src/lib/conversion-analytics.ts"), "utf8");
const route = readFileSync(resolve(root, "src/app/api/analytics/conversion/route.ts"), "utf8");
const productCard = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const productPage = readFileSync(resolve(root, "src/components/ProductPageContent.tsx"), "utf8");
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const tracker = readFileSync(resolve(root, "src/components/OrderTracker.tsx"), "utf8");

test("V463 defines only the intended conversion funnel events", () => {
  for (const event of ["product_view", "add_to_cart", "begin_checkout", "purchase"]) {
    assert.ok(analytics.includes(`"${event}"`));
    assert.ok(route.includes(`"${event}"`));
  }
  assert.doesNotMatch(analytics, /scroll_depth|fingerprint/i);
});

test("V463 telemetry is first-party and cookieless", () => {
  assert.match(analytics, /const ENDPOINT = "\/api\/analytics\/conversion"/);
  assert.match(analytics, /window\.sessionStorage/);
  assert.doesNotMatch(analytics, /document\.cookie/);
  assert.doesNotMatch(analytics, /google-analytics|googletagmanager|facebook|posthog/i);
});

test("V463 product views cover canonical pages and intentional modal opens", () => {
  assert.match(productPage, /trackConversion\(\s*"product_view"/);
  assert.match(productPage, /source:\s*"product_page"/);
  assert.match(productCard, /trackConversion\(\s*"product_view"/);
  assert.match(productCard, /source:\s*"product_modal"/);
});

test("V463 add-to-cart fires after the canonical cart add path", () => {
  const addIndex = productCard.indexOf("addItem({");
  const analyticsIndex = productCard.indexOf('trackConversion("add_to_cart"', addIndex);
  assert.ok(addIndex >= 0 && analyticsIndex > addIndex);
  assert.match(productCard, /variant_id: variant\?\.id/);
  assert.match(productCard, /value: price/);
});

test("V463 begin-checkout fires once from a real non-empty checkout visit", () => {
  assert.match(checkout, /beginCheckoutTracked = useRef\(false\)/);
  assert.match(checkout, /if \(beginCheckoutTracked\.current \|\| !items\.length\) return/);
  assert.match(checkout, /trackConversion\("begin_checkout"/);
});

test("V463 purchase is emitted only after paid truth including Stripe return", () => {
  assert.match(
    checkout,
    /if\s*\(\s*data\.paymentComplete\s*\|\|\s*data\.paymentStatus\s*===\s*"paid"\s*\)[\s\S]*?trackConversion\(\s*"purchase"/,
  );
  assert.match(
    tracker,
    /if\s*\(\s*paymentReturn\s*!==\s*"success"\s*\|\|\s*!paymentConfirmed\s*\|\|\s*!order\s*\)\s*return/,
  );
  assert.match(tracker, /persistent:\s*true/);
});

test("V463 server telemetry hashes raw transaction IDs and avoids customer PII", () => {
  assert.match(route, /transaction_ref:/);
  assert.match(route, /createHash\("sha256"\)/);
  assert.doesNotMatch(route, /transaction_id:/);
  assert.doesNotMatch(route, /customerEmail|customerPhone|firstName|lastName|address1|postalCode/);
  assert.doesNotMatch(route, /user-agent|x-forwarded-for|request\.ip/i);
});

test("V463 analytics failures can never block commerce", () => {
  assert.match(analytics, /Analytics must never interrupt storefront behavior/);
  assert.doesNotMatch(route, /create table|alter table|supabase/i);
  assert.doesNotMatch(analytics, /addItem\(|setQuantity\(|clear\(/);
});
