import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const helper = readFileSync(resolve(root, "src/lib/product-merchandising.ts"), "utf8");
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const productCard = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const marker = "/* Ichigo Ichie V4.62 — Matcha finder merchandising */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V462 CSS marker must exist");
const end = css.indexOf(
  "/* Ichigo Ichie V4.62.1 — Storefront paint stability */",
  start + marker.length,
);
assert.ok(end > start, "V462 CSS block end marker must exist");
const v462 = css.slice(start, end);

test("V462 derives finder tags from existing merchant-authored product content only", () => {
  assert.match(helper, /product\.ideal_for/);
  assert.match(helper, /product\.badge/);
  assert.match(helper, /product\.description_fr/);
  assert.match(helper, /product\.description_en/);
  assert.doesNotMatch(helper, /base_price/);
  assert.doesNotMatch(helper, /stock/);
});

test("V462 finder supports daily ceremonial usucha koicha and latte", () => {
  for (const tag of ["daily", "ceremonial", "usucha", "koicha", "latte"]) assert.ok(helper.includes(`"${tag}"`));
  assert.match(helper, /Quotidien/);
  assert.match(helper, /Cérémonie/);
});

test("V462 adds a Shop-only matcha finder without changing Menu rendering", () => {
  assert.match(catalog, /shop-matcha-finder-v462/);
  assert.match(catalog, /kind === "shop" && availableFinderTags\.length > 0/);
  assert.match(catalog, /productMatchesFinderTag/);
  assert.match(catalog, /MenuInfoCard/);
});

test("V462 combines finder and existing category filtering", () => {
  assert.match(catalog, /activeCategory === "all" \|\| product\.category_id === activeCategory/);
  assert.match(catalog, /productMatchesFinderTag\(product, activeFinderTag\)/);
  assert.match(catalog, /\[products, activeCategory, activeFinderTag, kind\]/);
});

test("V462 exposes only finder tags present in the Shop catalog", () => {
  assert.match(catalog, /new Set\(products\.flatMap\(productMatchaFinderTags\)\)/);
  assert.match(catalog, /MATCHA_FINDER_TAGS\.filter/);
});

test("V462 adds compact Best for guidance to Shop product cards", () => {
  assert.match(productCard, /const merchandisingTags = productMatchaFinderTags\(product\)/);
  assert.match(productCard, /product-merchandising-v462/);
  assert.match(productCard, /Idéal pour/);
  assert.match(productCard, /Best for/);
  assert.match(productCard, /merchandisingTags\.slice\(0, 3\)/);
});

test("V462 finder stays mobile-scrollable with touch-friendly controls", () => {
  assert.match(v462, /overflow-x: auto/);
  assert.match(v462, /min-height: 40px/);
  assert.match(v462, /@media \(max-width: 760px\)/);
  assert.match(catalog, /aria-pressed=\{activeFinderTag/);
});

test("V462 is merchandising-only with no commerce or schema mutation", () => {
  assert.doesNotMatch(helper, /addItem/);
  assert.doesNotMatch(helper, /setQuantity/);
  assert.doesNotMatch(catalog, /addItem\(/);
  assert.doesNotMatch(catalog, /setQuantity\(/);
  assert.doesNotMatch(v462, /position:\s*fixed/);
  assert.doesNotMatch(v462, /display:\s*none/);
  assert.doesNotMatch(v462, /create table/i);
  assert.doesNotMatch(v462, /alter table/i);
});
