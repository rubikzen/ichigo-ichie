import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const sell = readFileSync(resolve(root, "src/lib/product-sellability.ts"), "utf8");
const hook = readFileSync(resolve(root, "src/components/admin/useAdminCatalog.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V457 sellability preflight separates blockers from non-blocking warnings", () => {
  assert.match(sell, /level: "blocker" \| "warning"/);
  assert.match(sell, /readyToSell: blockers\.length === 0/);
  assert.match(sell, /primary_image_missing/);
});

test("V457 preserves legitimate free products by rejecting only negative or invalid prices", () => {
  assert.match(sell, /basePrice == null \|\| basePrice < 0/);
  assert.match(sell, /price == null \|\| price < 0/);
  assert.doesNotMatch(sell, /price <= 0/);
});

test("V457 shipping readiness follows the order pipeline product-weight fallback for active variants", () => {
  assert.match(sell, /productWeight <= 0 &&/);
  assert.match(sell, /active\.some/);
  assert.match(sell, /variant\.shipping_weight_g/);
  assert.match(sell, /product\.pickup_only/);
});

test("V457 stock zero is never a publication blocker", () => {
  assert.doesNotMatch(sell, /stock.*blocker/i);
  assert.doesNotMatch(sell, /stock <= 0/);
});

test("V457 canonical active Boutique save blocks sellability errors independently of content", () => {
  assert.match(hook, /productSellabilityPreflight/);
  assert.match(hook, /sellability\.blockers\.length > 0/);
  assert.match(hook, /de vente à corriger/);
  assert.match(hook, /return null/);
});

test("V457 quick publish opens Details when either content or commerce readiness blocks publication", () => {
  assert.match(admin, /productSellabilityPreflight\(product, productVariants\)/);
  assert.match(admin, /productContentIssues\(product\)\.length > 0 \|\|/);
  assert.match(admin, /Boolean\(sellability\?\.blockers\.length\)/);
  assert.match(admin, /chooseProduct\(product\);\s*return;/);
});

test("V457 drawer shows a compact PRÊT À VENDRE preflight with price shipping formats and photo", () => {
  assert.match(admin, /PRÊT À VENDRE/);
  assert.match(admin, /draftSellability\.checks\.map/);
  assert.match(sell, /label: "Prix"/);
  assert.match(sell, /label: product\.pickup_only \? "Retrait" : "Livraison"/);
  assert.match(sell, /label: "Formats"/);
  assert.match(sell, /label: "Photo"/);
});

test("V457 first publication remains locked by commerce blockers while warnings remain non-blocking", () => {
  assert.match(admin, /draftSellabilityBlockers\.length > 0/);
  assert.match(admin, /Configuration de vente à corriger avant publication/);
  assert.match(admin, /draftSellabilityWarnings/);
  assert.doesNotMatch(admin, /disabled=\{[^}]*draftSellabilityWarnings/);
});

test("V457 sellability presentation is responsive and reuses the existing publication guard", () => {
  assert.match(css, /Ichigo Ichie V4\.57 — Product sellability preflight/);
  assert.match(css, /sellability-card-v457/);
  assert.match(css, /blocked-by-sellability-v457/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(admin, /publish-guard-banner-v456/);
});

test("V457 remains schema-free and does not mutate checkout or storefront purchase logic", () => {
  assert.doesNotMatch(sell, /create table/i);
  assert.doesNotMatch(sell, /alter table/i);
  assert.doesNotMatch(admin, /addItem\(/);
  assert.doesNotMatch(hook, /checkout/i);
});
