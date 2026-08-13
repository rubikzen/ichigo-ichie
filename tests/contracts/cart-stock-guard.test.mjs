import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const productCard = source("src/components/ProductCard.tsx");
const cartPage = source("src/components/CartPageClient.tsx");

test("product card counts all cart configurations sharing the same stock unit", () => {
  assert.match(productCard, /quantityInCartForStock/);
  assert.match(productCard, /item\.productId !== product\.id/);
  assert.match(productCard, /item\.variantId === variant\.id/);
  assert.match(productCard, /stockLimitReached/);
});

test("direct and modal add actions stop when cart already consumes available stock", () => {
  assert.match(productCard, /const canAdd = hasStock && !stockLimitReached/);
  assert.match(productCard, /showStock && quantityInCartForStock >= currentStock/);
  assert.match(productCard, /disabled=\{isSoldOut \|\| \(!requiresChoice && stockLimitReached\)\}/);
  assert.match(productCard, /Quantité maximale atteinte/);
});

test("cart quantity controls include sibling configurations in the stock limit", () => {
  assert.match(cartPage, /function stockUnitKey/);
  assert.match(cartPage, /function quantityUsedByOtherLines/);
  assert.match(cartPage, /usedElsewhere \+ next > stock/);
  assert.match(cartPage, /maxForThisLine/);
});

test("legacy overstock carts cannot proceed to checkout", () => {
  assert.match(cartPage, /const hasStockConflict = items\.some/);
  assert.match(cartPage, /aria-disabled=\{hasStockConflict\}/);
  assert.match(cartPage, /if \(hasStockConflict\) event\.preventDefault\(\)/);
  assert.match(cartPage, /Corriger les quantités/);
});

test("cart editor also validates aggregate stock across configurations", () => {
  assert.match(cartPage, /nextStockUnitKey/);
  assert.match(cartPage, /quantityOnOtherLines/);
  assert.match(cartPage, /mergedQuantity = item\.quantity \+ quantityOnOtherLines/);
  assert.match(cartPage, /stockConflict = maxStock !== null && mergedQuantity > maxStock/);
});
