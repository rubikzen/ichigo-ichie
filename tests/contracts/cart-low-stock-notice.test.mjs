import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import { cartStockNotice } from "../../src/lib/cart-stock-notice.ts";

const cart = readFileSync(resolve(process.cwd(), "src/components/CartPageClient.tsx"), "utf8");

test("cart stock notices only disclose zero or fewer than five units", () => {
  assert.equal(cartStockNotice(null, false, "fr"), null);
  assert.equal(cartStockNotice(Number.NaN, false, "fr"), null);
  assert.equal(cartStockNotice(0, false, "fr"), "Rupture de stock");
  assert.equal(cartStockNotice(2, false, "fr"), "Plus que 2 en stock");
  assert.equal(cartStockNotice(4, false, "fr"), "Plus que 4 en stock");
  assert.equal(cartStockNotice(5, false, "fr"), null);
  assert.equal(cartStockNotice(9, false, "fr"), null);
  assert.equal(cartStockNotice(14, false, "fr"), null);
});

test("stock notices are bilingual and keep explicit out-of-stock messaging", () => {
  assert.equal(cartStockNotice(0, false, "en"), "Sold out");
  assert.equal(cartStockNotice(2, false, "en"), "Only 2 left");
  assert.equal(cartStockNotice(5, false, "en"), null);
});

test("invalid quantities still show an error without disclosing high inventory", () => {
  assert.match(cartStockNotice(2, true, "fr") ?? "", /Plus que 2 en stock/);
  assert.match(cartStockNotice(2, true, "fr") ?? "", /Quantité demandée trop élevée/);
  assert.equal(cartStockNotice(14, true, "fr"), "Quantité demandée supérieure au stock disponible");
  assert.equal(cartStockNotice(14, true, "en"), "Requested quantity exceeds available stock");
  assert.doesNotMatch(cartStockNotice(14, true, "fr") ?? "", /14/);
});

test("cart UI renders only the derived notice and does not change stock guards", () => {
  assert.match(cart, /const stockNotice = cartStockNotice\(stock, lineStockConflict, language\)/);
  assert.match(cart, /\{stockNotice && <small/);
  assert.match(cart, /\{stockNotice\}/);
  assert.doesNotMatch(cart, /\$\{stock\} en stock/);
  assert.doesNotMatch(cart, /\$\{stock\} in stock/);
  assert.match(cart, /const hasStockConflict = items\.some/);
  assert.match(cart, /usedElsewhere \+ next > stock/);
  assert.match(cart, /maxForThisLine !== null && item\.quantity > maxForThisLine/);
  assert.match(cart, /disabled=\{maxForThisLine !== null && item\.quantity >= maxForThisLine\}/);
  assert.match(cart, /aria-disabled=\{hasStockConflict \|\| checkoutUnavailable\}/);
});
