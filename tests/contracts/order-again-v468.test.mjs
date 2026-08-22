import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const route = src("src/app/api/orders/[token]/reorder/route.ts");
const button = src("src/components/ReorderOrderButton.tsx");
const tracker = src("src/components/OrderTracker.tsx");
const account = src("src/components/CustomerAccount.tsx");
const css = src("src/app/styles/globals-04.css");

test("V468 reorder endpoint is token-gated rate-limited and terminal-order only", () => {
  assert.match(route, /UUID_RE/);
  assert.match(route, /\.eq\("public_token", token\)/);
  assert.match(route, /orders:reorder:v468/);
  assert.match(route, /limit: 20/);
  assert.match(route, /terminalOrder\(order\)/);
  assert.match(route, /REORDER_ORDER_ACTIVE/);
});

test("V468 rehydrates current active Boutique products and exact current variants", () => {
  assert.match(route, /\.from\("products"\)/);
  assert.match(route, /\.from\("product_variants"\)/);
  assert.match(route, /categoryKind\.get/);
  assert.match(route, /!== "shop"/);
  assert.match(route, /currentVariants/);
  assert.match(route, /historicalVariantId/);
  assert.match(route, /variant\.price : product\.base_price/);
  assert.match(route, /variant \? variant\.stock : product\.stock/);
});

test("V468 revalidates current option groups and never trusts historical price deltas", () => {
  assert.match(route, /\.from\("product_option_groups"\)/);
  assert.match(route, /\.from\("option_groups"\)/);
  assert.match(route, /\.from\("option_values"\)/);
  assert.match(route, /value\.active/);
  assert.match(route, /value\.price_delta/);
  assert.match(route, /configuration_changed/);
  const historyStart = route.indexOf("function historicalChoices");
  const historyEnd = route.indexOf("\n}\n\nfunction issue", historyStart);
  assert.ok(historyStart >= 0 && historyEnd > historyStart);
  const historicalParser = route.slice(historyStart, historyEnd);
  assert.match(historicalParser, /groupId/);
  assert.match(historicalParser, /valueId/);
  assert.doesNotMatch(
    historicalParser,
    /priceDelta|price_delta|unit_price|line_total/,
  );
});

test("V468 preparation is read-only and never creates a duplicate order", () => {
  assert.doesNotMatch(route, /\.insert\(/);
  assert.doesNotMatch(route, /\.update\(/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.doesNotMatch(route, /\.rpc\(/);
  assert.doesNotMatch(button, /\/api\/orders["'`]/);
  assert.doesNotMatch(button, /acceptedTerms|clientReference|checkoutSession/);
  assert.match(button, /\/reorder/);
});

test("V468 merges into the existing cart while respecting stock-unit and 20-unit limits", () => {
  assert.match(button, /const \{ items: cartItems, addItem \} = useCart\(\)/);
  assert.match(button, /stockReserved/);
  assert.match(button, /keyReserved/);
  assert.match(button, /prepared\.availableStock - alreadyOnStockUnit/);
  assert.match(button, /20 - alreadyOnKey/);
  assert.match(button, /addItem\(\{/);
  assert.doesNotMatch(button, /\bclear\(\)/);
});

test("V468 conversion attribution accepts reorder end to end", () => {
  const analytics = src("src/lib/conversion-analytics.ts");
  const analyticsServer = src("src/lib/conversion-analytics-server.ts");
  const analyticsRoute = src("src/app/api/analytics/conversion/route.ts");

  assert.match(button, /source: "reorder"/);
  assert.match(
    analytics,
    /source\?: "product_page" \| "product_modal" \| "reorder"/,
  );
  assert.match(
    analyticsServer,
    /source\?: "product_page" \| "product_modal" \| "reorder"/,
  );
  assert.match(analyticsRoute, /input\.source === "reorder"/);
});

test("V468 always communicates current-price semantics and does not restore historical promos", () => {
  assert.match(route, /previousPromotionIgnored/);
  assert.match(button, /Prix, disponibilité et options actuels/);
  assert.match(button, /promotion de l’ancienne commande n’est pas recopiée/);
  assert.doesNotMatch(route, /bundleId|bundleGroupId/);
});

test("V468 exposes order-again only on terminal tracking and account orders", () => {
  assert.match(tracker, /const canReorder =/);
  assert.match(tracker, /\["completed", "cancelled", "refunded"\]/);
  assert.match(tracker, /<ReorderOrderButton/);
  assert.match(account, /const reorderAvailable =/);
  assert.match(account, /order\.public_token/);
  assert.match(account, /<ReorderOrderButton/);
});

test("V468 provides bilingual partial-stock and reconfiguration recovery instead of silent substitution", () => {
  assert.match(button, /unit\(s\) were not added/);
  assert.match(button, /unité\(s\) non ajoutée\(s\)/);
  assert.match(button, /Reconfigurer/);
  assert.match(button, /Configure/);
  assert.match(button, /Voir mon panier/);
  assert.match(button, /View cart/);
  assert.match(button, /quantity < prepared\.requestedQuantity/);
});

test("V468 keeps reorder responsive and touch-friendly", () => {
  assert.match(css, /V468 — secure order-again flow/);
  assert.match(css, /\.reorder-order-v468/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /min-height: 44px/);
});
