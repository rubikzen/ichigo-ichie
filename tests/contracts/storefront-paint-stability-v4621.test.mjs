import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

const marker = "/* Ichigo Ichie V4.62.1 — Storefront paint stability */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V462.1 CSS marker must exist");
const block = css.slice(start);

test("V462.1 keeps mobile Shop filters in normal document flow below the site header", () => {
  assert.match(block, /\.onepage-catalog-shop \.onepage-catalog-toolbar-v225/);
  assert.match(block, /\.onepage-catalog-shop \.shop-matcha-finder-v462/);
  assert.match(block, /position: static !important/);
  assert.match(block, /top: auto !important/);
});

test("V462.1 prevents product copy from overflowing the mobile card", () => {
  assert.match(block, /\.onepage-catalog-shop \.product-copy/);
  assert.match(block, /min-width: 0/);
  assert.match(block, /overflow: hidden/);
  assert.match(block, /overflow-wrap: anywhere/);
});

test("V462.1 clamps long product descriptions without hiding purchase controls", () => {
  assert.match(block, /-webkit-line-clamp: 2/);
  assert.match(block, /\.onepage-catalog-shop \.product-card-cta/);
  assert.doesNotMatch(block, /display:\s*none/);
});

test("V462.1 removes content-visibility from dynamic catalog groups", () => {
  const v461Start = css.indexOf("/* Ichigo Ichie V4.61 — Storefront performance pass */");
  const v462Start = css.indexOf("/* Ichigo Ichie V4.62 — Matcha finder merchandising */");
  assert.ok(v461Start >= 0 && v462Start > v461Start);
  const v461 = css.slice(v461Start, v462Start);
  assert.doesNotMatch(
    v461,
    /\.premium-home-v224 \.onepage-category-group\s*\{[\s\S]*?content-visibility:\s*auto/,
  );
});
