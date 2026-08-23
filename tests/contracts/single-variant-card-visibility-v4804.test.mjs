import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const card = src("src/components/ProductCard.tsx");
const css = src("src/app/styles/globals-04.css");

test("V480.4 derives a visible label set for exactly one active variant", () => {
  assert.match(
    card,
    /const singleVariantLabels = selectableVariants\.length === 1/,
  );
  assert.match(
    card,
    /productVariantLabel\(selectableVariants\[0\], language\)/,
  );
  assert.match(card, /\.split\("·"\)/);
});

test("V480.4 avoids exposing the generic Format fallback as merchandising", () => {
  assert.match(
    card,
    /\.filter\(\(label\) => label && label !== "Format"\)/,
  );
});

test("V480.4 renders single packaging and weight on the storefront card", () => {
  assert.match(
    card,
    /singleVariantLabels\.length > 0 && <div className="product-card-chips product-card-single-variant-v4804"/,
  );
  assert.match(
    card,
    /singleVariantLabels\.map\(\(label\) => <span key=\{label\}>\{label\}<\/span>\)/,
  );
  assert.match(
    card,
    /language === "fr" \? "Format du produit" : "Product format"/,
  );
});

test("V480.4 preserves existing multiple-packaging merchandising", () => {
  assert.match(
    card,
    /packagingLabels\.length > 1 && <div className="product-card-chips"/,
  );
  assert.match(
    card,
    /packagingLabels\.map\(\(label\) => <span key=\{label\}>\{label\}<\/span>\)/,
  );
});

test("V480.4 preserves existing multiple-size merchandising", () => {
  assert.match(
    card,
    /packagingLabels\.length <= 1 && formatLabels\.length > 1 && <div className="product-card-chips"/,
  );
  assert.match(card, /formatLabels\.slice\(0, 3\)/);
});

test("V480.4 uses the V480.2 reserved format row without new card stretching", () => {
  const marker = "/* V480.2 — Balanced mobile product-card slots */";
  const start = css.indexOf(marker);
  assert.ok(start >= 0);
  const v4802 = css.slice(start);

  assert.match(
    v4802,
    /\.product-card-chips \{[\s\S]*?grid-row: 1;[\s\S]*?min-height: 30px;/,
  );
  assert.doesNotMatch(
    card,
    /product-card-single-variant-v4804[\s\S]*?style=\{\{[\s\S]*?height/,
  );
});

test("V480.4 does not change choice, cart, stock or modal behavior", () => {
  assert.match(card, /const requiresChoice = selectableVariants\.length > 1/);
  assert.match(card, /if \(requiresChoice\) \{\s*openProductDetails/);
  assert.match(card, /handleAdd\(\)/);
  assert.match(card, /addItem\(/);
  assert.match(card, /RestockNotify/);
  assert.match(card, /product-modal product-modal-v28/);
  assert.doesNotMatch(card, /suppressHydrationWarning/);
});
