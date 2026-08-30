import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/components/ProductModal.tsx"), "utf8");

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
    modal,
    /\{item\.stock > 0 && <small>\{money\(item\.price, language\)\}<\/small>\}/,
  );
  assert.match(
    modal,
    /\{item\.stock <= 0 && <b>\{language === "fr" \? "Épuisé" : "Sold out"\}<\/b>\}/,
  );
});

test("sold-out product modal hides its main price block and exposes restock recovery", () => {
  assert.match(modal, /\) : !hasStock \? \([\s\S]*?<RestockNotify/);
  assert.match(modal, /productName=\{name\}[\s\S]*?context="modal"/);
  assert.match(modal, /\) : \([\s\S]*?<div className="product-price-block">/);
});
