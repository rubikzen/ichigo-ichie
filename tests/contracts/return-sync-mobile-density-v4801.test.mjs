import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const tracker = src("src/components/OrderTracker.tsx");
const e2e = src("tests/e2e/order-payment-actions.spec.ts");
const css = src("src/app/styles/globals-04.css");

const marker =
  "/* V480.1 — CI return-sync race and mobile card density hotfix */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V480.1 CSS marker must exist");
const v481Boundary = css.indexOf("/* V481 — Cart & checkout conversion polish */", start + 1);
const v4801 = css.slice(start, v481Boundary >= 0 ? v481Boundary : undefined);

test("V480.1 tracks when payment-return URL params are ready", () => {
  assert.match(
    tracker,
    /const \[paymentReturnParamsReady, setPaymentReturnParamsReady\] = useState\(false\)/,
  );
  assert.match(tracker, /params\.get\("session_id"\)/);
  assert.match(tracker, /setPaymentReturnSessionId\(sessionId\)/);
  assert.match(tracker, /setPaymentReturnParamsReady\(true\)/);
});

test("V480.1 never starts public order reconciliation before return params are parsed", () => {
  assert.match(
    tracker,
    /useEffect\(\(\) => \{\s*if \(!paymentReturnParamsReady\) return;\s*let active = true;/,
  );
  assert.match(
    tracker,
    /\[\s*token,\s*paymentReturnParamsReady,\s*orderRefreshIntervalMs,/,
  );
});

test("successful Stripe returns still send the captured Checkout Session id", () => {
  assert.match(
    tracker,
    /publicToken: token,[\s\S]*?paymentReturnSessionId[\s\S]*?\{ sessionId: paymentReturnSessionId \}/,
  );
  assert.match(
    e2e,
    /sessionId: "cs_test_v436return"/,
  );
  assert.match(
    e2e,
    /successful Stripe return reconciles its Checkout Session before staying pending/,
  );
});

test("V480.1 preserves normal Stripe reconciliation throttling and order polling", () => {
  assert.match(tracker, /stripeSyncLastAttempt/);
  assert.match(tracker, /15_000/);
  assert.match(tracker, /window\.setInterval\(load, orderRefreshIntervalMs\)/);
  assert.match(tracker, /if \(await reconcileStripeIfNeeded\(data\)\)/);
});

test("V480.1 stops homepage mobile cards from stretching internal whitespace", () => {
  assert.match(
    v4801,
    /\.onepage-catalog-shop \.onepage-product-grid \{\s*align-items: start !important;/,
  );
  assert.match(
    v4801,
    /\.product-card\.product-card-compact \{[\s\S]*?height: auto !important;[\s\S]*?align-self: start !important;/,
  );
  assert.match(
    v4801,
    /\.product-copy \{\s*flex: 0 0 auto !important;/,
  );
  assert.match(v4801, /\.product-title-row \{\s*min-height: 36px !important;/);
  assert.match(v4801, /\.product-card-meta \{[\s\S]*?min-height: 0 !important;/);
});

test("V480.1 applies the same compact sizing to canonical mobile collection cards", () => {
  assert.match(
    v4801,
    /\.shop-collection-grid-v473 \{\s*align-items: start !important;/,
  );
  assert.match(
    v4801,
    /\.shop-collection-grid-v473[\s\S]*?\.product-copy \{\s*flex: 0 0 auto !important;/,
  );
  assert.match(
    v4801,
    /\.shop-collection-grid-v473[\s\S]*?\.product-card-meta \{[\s\S]*?min-height: 0 !important;/,
  );
});

test("V480.1 keeps stock and CTA visible while reducing only empty space", () => {
  assert.match(
    v4801,
    /\.product-stock-card \{[\s\S]*?min-height: 0 !important;/,
  );
  assert.match(
    v4801,
    /\.product-card-cta \{\s*margin-top: 8px !important;/,
  );
  assert.doesNotMatch(v4801, /\.product-card-cta \{\s*display: none/);
  assert.doesNotMatch(v4801, /\.product-stock-card \{\s*display: none/);
});

test("V480.1 introduces no checkout database pricing stock or schema mutation", () => {
  assert.doesNotMatch(tracker, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(v4801, /supabase|checkout|stripe|order_items|orders/);
  assert.doesNotMatch(v4801, /"@type":/);
});
