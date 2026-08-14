import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");

test("catalog sorting callback is stable and memo dependencies are complete", () => {
  assert.match(catalog, /useCallback/);
  assert.match(catalog, /const sortProducts = useCallback/);
  assert.match(catalog, /\[categories, filtered, sortProducts\]/);
});

test("ProductCard option changes reset through keyed state instead of effect synchronization", () => {
  assert.match(product, /function productCardStateKey/);
  assert.match(product, /JSON\.stringify\(product\.option_groups\)/);
  assert.match(product, /<ProductCardStateful key=\{productCardStateKey\(product\)\}/);
  assert.doesNotMatch(product, /\[product\.id, product\.option_groups\]/);
});

test("checkout city lookup declares city and verification dependencies", () => {
  assert.match(checkout, /\[postalCode, orderType, city, addressVerified\]/);
});
