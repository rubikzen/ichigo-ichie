import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const toolbar = readFileSync(resolve(root, "tests/contracts/boutique-toolbar-v382.test.mjs"), "utf8");
const soldOutPrice = readFileSync(resolve(root, "tests/contracts/sold-out-price-visibility-v423.test.mjs"), "utf8");

test("Boutique availability uses active variant stock and falls back to base product stock", () => {
  assert.match(catalog, /function productAvailableStock\(product: Product\)/);
  assert.match(catalog, /activeVariants\.reduce\([\s\S]*?Math\.max\(0, Number\(variant\.stock\) \|\| 0\)/);
  assert.match(catalog, /return Math\.max\(0, Number\(product\.stock\) \|\| 0\)/);
});

test("fully sold-out Boutique products sort after purchasable products", () => {
  assert.match(
    catalog,
    /if \(kind === "shop"\) \{[\s\S]*?const soldOutA = productAvailableStock\(a\) <= 0;[\s\S]*?const soldOutB = productAvailableStock\(b\) <= 0;[\s\S]*?if \(soldOutA !== soldOutB\) return soldOutA \? 1 : -1;/,
  );
  assert.match(catalog, /\}\s*if \(sortMode === "price-asc"\)/);
});

test("recommended order remains the admin sort_order inside each availability group", () => {
  assert.match(catalog, /return \(a\.sort_order \?\? 0\) - \(b\.sort_order \?\? 0\);/);
  assert.match(catalog, /\}\), \[kind, sortMode, language\]\);/);
  assert.match(toolbar, /value="recommended"/);
});

test("price sorting aligns with V423 by preferring only in-stock variants", () => {
  assert.match(catalog, /const availableVariants = activeVariants\.filter\(\(variant\) => Number\(variant\.stock\) > 0\)/);
  assert.match(catalog, /const priceSource = availableVariants\.length \? availableVariants : activeVariants/);
  assert.match(catalog, /Math\.min\(\.\.\.priceSource\.map\(\(variant\) => Number\(variant\.price\) \|\| 0\)\)/);
  assert.match(soldOutPrice, /From price is calculated only from variants that can actually be purchased/);
});
