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

test("ProductCard option synchronization depends on the data it reads", () => {
  assert.match(product, /\[product\.id, product\.option_groups\]/);
  assert.doesNotMatch(product, /optionSignature/);
});

test("checkout city lookup declares city and verification dependencies", () => {
  assert.match(checkout, /\[postalCode, orderType, city, addressVerified\]/);
});
