import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const product = readFileSync(resolve(process.cwd(), "src/components/ProductCard.tsx"), "utf8");

test("fully sold-out product cards do not render a storefront price", () => {
  assert.match(product, /const isSoldOut = totalStock <= 0/);
  assert.match(
    product,
    /\{!isSoldOut && <strong className="product-card-price">[\s\S]*?money\(minimumPrice, language\)[\s\S]*?<\/strong>\}/,
  );
});

test("From price is calculated only from variants that can actually be purchased", () => {
  assert.match(product, /const availableVariants = selectableVariants\.filter\(\(item\) => item\.stock > 0\)/);
  assert.match(
    product,
    /const minimumPrice = availableVariants\.length \? Math\.min\(\.\.\.availableVariants\.map\(\(item\) => item\.price\)\) : product\.base_price/,
  );
});

test("sold-out variant choices show Sold out instead of their price", () => {
  assert.match(
    product,
    /\{item\.stock > 0 && <small>\{money\(item\.price, language\)\}<\/small>\}\{item\.stock <= 0 && <b>/,
  );
});

test("sold-out product modal hides its main price block while keeping unavailable feedback", () => {
  assert.match(product, /\{hasStock && <div className="product-price-block">/);
  assert.match(product, /!hasStock[\s\S]*?"Indisponible"[\s\S]*?"Unavailable"/);
});
