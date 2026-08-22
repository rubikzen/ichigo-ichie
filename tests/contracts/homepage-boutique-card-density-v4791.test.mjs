import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const css = src("src/app/styles/globals-04.css");
const catalog = src("src/components/UnifiedCatalogSections.tsx");
const card = src("src/components/ProductCard.tsx");

const marker = "/* V479.1 — Homepage Boutique card density fix */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V479.1 CSS marker must exist");
const v4791 = css.slice(start);

test("V479.1 targets the actual homepage Boutique grid that V479 missed", () => {
  assert.match(catalog, /onepage-product-grid/);
  assert.match(catalog, /onepage-catalog-\$\{kind\}/);
  assert.match(
    v4791,
    /\.onepage-catalog-shop \.onepage-product-grid/,
  );
});

test("V479.1 makes homepage Boutique two-column from phone through small tablet", () => {
  assert.match(
    v4791,
    /@media \(min-width: 360px\) and \(max-width: 820px\)/,
  );
  assert.match(
    v4791,
    /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
});

test("V479.1 keeps very narrow phones one-column", () => {
  assert.match(v4791, /@media \(max-width: 359px\)/);
  assert.match(
    v4791,
    /\.onepage-catalog-shop \.onepage-product-grid \{\s*grid-template-columns: 1fr !important;/,
  );
});

test("V479.1 uses a compact 4 by 5 product-media frame and preserves whole packaging", () => {
  assert.match(v4791, /aspect-ratio: 4 \/ 5 !important/);
  assert.match(v4791, /object-fit: contain !important/);
  assert.match(v4791, /object-position: center center !important/);
});

test("V479.1 removes long copy from scan-heavy two-column homepage cards", () => {
  assert.match(
    v4791,
    /\.product-card-description \{\s*display: none !important;/,
  );
  assert.match(card, /className="product-permalink-v431"/);
});

test("V479.1 preserves use format stock and CTA while limiting visual noise", () => {
  assert.match(v4791, /\.product-merchandising-v462/);
  assert.match(v4791, /span:nth-of-type\(n \+ 3\)/);
  assert.match(v4791, /\.product-card-chips/);
  assert.match(v4791, /span:nth-child\(n \+ 3\)/);
  assert.match(v4791, /\.product-stock-card/);
  assert.match(v4791, /\.product-card-cta/);
});

test("V479.1 compacts category heading without changing canonical collection link", () => {
  assert.match(v4791, /\.onepage-category-heading/);
  assert.match(v4791, /\.onepage-category-collection-link-v473/);
  assert.match(catalog, /categoryCollectionPath\(category\)/);
  assert.match(catalog, /Voir la collection →/);
});

test("V479.1 is CSS-only and leaves ProductCard commerce logic untouched", () => {
  assert.match(card, /const stockLimitReached =/);
  assert.match(card, /const handleAdd = \(\) =>/);
  assert.match(card, /addItem\(/);
  assert.match(card, /RestockNotify/);
  assert.doesNotMatch(v4791, /supabase|checkout|stripe|orders|order_items/);
});
