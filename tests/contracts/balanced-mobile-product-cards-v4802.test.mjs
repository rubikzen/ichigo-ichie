import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const css = src("src/app/styles/globals-04.css");
const card = src("src/components/ProductCard.tsx");

const marker = "/* V480.2 — Balanced mobile product-card slots */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V480.2 CSS marker must exist");
const v481Boundary = css.indexOf("/* V481 — Cart & checkout conversion polish */", start + 1);
const v4802 = css.slice(start, v481Boundary >= 0 ? v481Boundary : undefined);

test("V480.2 gives homepage two-column cards deterministic information rows", () => {
  assert.match(v4802, /@media \(min-width: 360px\) and \(max-width: 820px\)/);
  assert.match(v4802, /\.onepage-catalog-shop[\s\S]*?\.product-copy \{[\s\S]*?display: grid !important;[\s\S]*?grid-template-rows: 40px 16px 22px minmax\(56px, auto\) minmax\(48px, auto\)/);
});

test("V480.2 reserves title and price space without whole-card stretching", () => {
  assert.match(v4802, /\.onepage-catalog-shop[\s\S]*?\.product-title-row \{[\s\S]*?height: 40px;/);
  assert.match(v4802, /-webkit-line-clamp: 2/);
  assert.match(v4802, /\.product-card-price \{[\s\S]*?white-space: nowrap;/);
  assert.doesNotMatch(v4802, /\.product-card\.product-card-compact \{\s*height: 100%/);
});

test("V480.2 reserves small rating and usage slots", () => {
  assert.match(v4802, /\.product-card-rating-v4661 \{[\s\S]*?grid-row: 2;/);
  assert.match(v4802, /\.product-merchandising-v462 \{[\s\S]*?grid-row: 3;[\s\S]*?min-height: 22px;/);
});

test("V480.2 reserves one compact format row before stock", () => {
  assert.match(v4802, /\.product-card-meta \{[\s\S]*?grid-template-rows: 30px 20px auto;/);
  assert.match(v4802, /\.product-card-chips \{[\s\S]*?grid-row: 1;[\s\S]*?min-height: 30px;/);
  assert.match(v4802, /\.product-stock-card \{[\s\S]*?grid-row: 2;[\s\S]*?min-height: 20px !important;/);
});

test("V480.2 pins CTA and restock to the same final slot", () => {
  assert.match(v4802, /\.product-card-cta \{[\s\S]*?grid-row: 5;[\s\S]*?min-height: 48px !important;/);
  assert.match(v4802, /\.restock-notify-v425 \{[\s\S]*?grid-row: 5;[\s\S]*?min-height: 48px;/);
});

test("V480.2 mirrors the balanced anatomy on canonical mobile collections", () => {
  assert.match(v4802, /@media \(min-width: 360px\) and \(max-width: 640px\)/);
  assert.match(v4802, /\.shop-collection-grid-v473[\s\S]*?\.product-copy \{[\s\S]*?display: grid !important;/);
  assert.match(v4802, /\.shop-collection-grid-v473[\s\S]*?\.product-card-meta \{[\s\S]*?grid-template-rows: 30px 20px auto;/);
});

test("V480.2 keeps ultra-narrow one-column phones on natural flow", () => {
  assert.match(v4802, /@media \(max-width: 359px\)/);
  assert.match(v4802, /\.product-copy \{\s*display: flex !important;/);
});

test("V480.2 leaves commerce behavior untouched", () => {
  assert.match(card, /const handleAdd = \(\) =>/);
  assert.match(card, /addItem\(/);
  assert.match(card, /setQuantity\(/);
  assert.match(card, /removeItem\(/);
  assert.match(card, /RestockNotify/);
  assert.match(card, /product-modal product-modal-v28/);
  assert.doesNotMatch(v4802, /supabase|checkout|stripe|order_items|orders/);
});
