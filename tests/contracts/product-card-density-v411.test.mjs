import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/components/ProductModal.tsx"), "utf8");

test("desktop product media uses a compact 4 by 5 frame", () => {
  assert.match(css, /Ichigo Ichie V4\.11 — Compact desktop product media/);
  assert.match(css, /@media \(min-width: 821px\)[\s\S]*product-card\.product-card-compact \.product-image-button[\s\S]*aspect-ratio: 4 \/ 5 !important/);
  assert.match(css, /height: auto !important/);
  assert.match(css, /min-height: 0 !important/);
});

test("desktop product image fills the compact frame without distortion", () => {
  assert.match(css, /product-image-button > \.product-image[\s\S]*width: 100% !important/);
  assert.match(css, /product-image-button > \.product-image[\s\S]*height: 100% !important/);
  assert.match(css, /object-fit: cover/);
  assert.match(css, /object-position: center/);
});

test("existing mobile compact product media remains 4 by 3", () => {
  assert.match(css, /MOBILE PRODUCT CARD COMPACT UX v252[\s\S]*@media \(max-width: 820px\)[\s\S]*product-card-compact \.product-image-button[\s\S]*aspect-ratio: 4 \/ 3/);
});

test("V411 leaves product data stock cart and modal behavior untouched", () => {
  assert.match(card, /<article className="product-card product-card-compact">/);
  assert.match(card, /<SafeImage[\s\S]*className="product-image"/);
  assert.match(card, /const stockLimitReached =/);
  assert.match(card, /const handleAdd = \(\) =>/);
  assert.match(card, /import\("\.\/ProductModal"\)/);
  assert.match(modal, /product-modal product-modal-v28/);
});
