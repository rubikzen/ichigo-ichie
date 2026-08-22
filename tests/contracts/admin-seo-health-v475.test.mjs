import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const helper = src("src/lib/seo-health.ts");
const route = src("src/app/api/admin/seo-health/route.ts");
const ui = src("src/components/admin/SeoHealthAdmin.tsx");
const orders = src("src/components/admin/AdminOrders.tsx");
const productContent = src("src/lib/product-content.ts");
const merchandising = src("src/lib/product-merchandising.ts");
const css = src("src/app/styles/globals-04.css");

test("V475 defines one deterministic read-only SEO health model", () => {
  assert.match(helper, /export function buildSeoHealthReport/);
  assert.match(helper, /SeoHealthProductRow/);
  assert.match(helper, /SeoHealthGlobalCheck/);
  assert.doesNotMatch(helper, /fetch\(|createServiceSupabase|createBrowserSupabase/);
});

test("V475 reuses existing editorial and merchandising truth instead of creating parallel quality rules", () => {
  assert.match(helper, /auditProductContent/);
  assert.match(helper, /productMatchaFinderTags/);
  assert.match(productContent, /export function auditProductContent/);
  assert.match(merchandising, /export function productMatchaFinderTags/);
});

test("V475 audits canonical slug metadata image Offer collection and intent-link readiness", () => {
  for (const token of [
    "slug_duplicate",
    "title_long",
    "description_short",
    "image_missing",
    "offer_invalid",
    "category_slug_duplicate",
    "intent_links_missing",
  ]) assert.match(helper, new RegExp(token));
  assert.match(helper, /\/boutique\/categorie\//);
  assert.match(helper, /\/boutique\//);
});

test("V475 review signal is approved-only and obeys the same review visibility settings as V474", () => {
  assert.match(route, /\.eq\("status", "approved"\)/);
  assert.match(helper, /settings\.shop_reviews_enabled/);
  assert.match(helper, /settings\.shop_reviews_show_rating/);
  assert.match(helper, /schemaEligible/);
  assert.doesNotMatch(route, /order_id|order_item_id|public_token|customer_email/);
});

test("V475 endpoint is admin-only and scopes audit to active Boutique categories and products", () => {
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /\.eq\("kind", "shop"\)/);
  assert.match(route, /\.eq\("active", true\)/);
  assert.match(route, /\.in\("category_id", categoryIds\)/);
  assert.match(route, /\[SEO_HEALTH_V475_ERROR\]/);
});

test("V475 endpoint batches images variants reviews and settings without per-product requests", () => {
  assert.match(route, /Promise\.all/);
  assert.match(route, /\.from\("product_images"\)/);
  assert.match(route, /\.from\("product_variants"\)/);
  assert.match(route, /\.from\("product_reviews"\)/);
  assert.match(route, /\.from\("site_settings"\)/);
  assert.doesNotMatch(route, /for .*await|forEach\(async/);
});

test("V475 dashboard exposes score priorities filters search refresh and public-page recovery links", () => {
  assert.match(ui, /Santé SEO Boutique/);
  assert.match(ui, /Score moyen/);
  assert.match(ui, /Priorités/);
  assert.match(ui, /type="search"/);
  assert.match(ui, /setRefreshKey/);
  assert.match(ui, /Voir la fiche ↗/);
  assert.match(ui, /Collection ↗/);
});

test("V475 mounts inside the existing Pilotage Boutique alongside current operational dashboards", () => {
  assert.match(orders, /import \{ SeoHealthAdmin \}/);
  assert.match(
    orders,
    /<InventoryForecastAdmin supabase=\{supabase\} \/>[\s\S]*?<SeoHealthAdmin supabase=\{supabase\} \/>[\s\S]*?<ConversionAnalyticsAdmin supabase=\{supabase\} \/>/,
  );
  assert.match(orders, /Pilotage Boutique/);
});

test("V475 admin audit is responsive and keeps mobile controls touch-scrollable", () => {
  assert.match(css, /V475 — admin SEO health audit/);
  assert.match(css, /@media \(max-width:1080px\)/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /@media \(max-width:430px\)/);
  assert.match(css, /overflow-x:auto/);
});

test("V475 remains diagnostic only with no schema migration commerce order or stock mutation", () => {
  // AdminOrders is an existing operational host and legitimately mutates orders.
  // V475 only mounts SeoHealthAdmin there, so mutation checks must be scoped to
  // the new audit model, endpoint and dashboard themselves.
  const auditFiles = [helper, route, ui].join("\n");

  assert.doesNotMatch(
    auditFiles,
    /\.insert\(|\.update\(|\.delete\(|\.rpc\(/,
  );
  assert.doesNotMatch(
    auditFiles,
    /from\("orders"\)|from\("order_items"\)/,
  );
  assert.doesNotMatch(auditFiles, /stock\s*[-+]=|clear\(\)/);
  assert.doesNotMatch(auditFiles, /supabase\/migrations/);

  assert.match(orders, /<SeoHealthAdmin supabase=\{supabase\} \/>/);
});
