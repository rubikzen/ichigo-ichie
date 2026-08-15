import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const alignment = readFileSync(resolve(root, "tests/contracts/product-card-alignment.test.mjs"), "utf8");

test("shop groups with fewer than four products opt into compact sparse rows", () => {
  assert.match(
    catalog,
    /kind === "shop" && categoryProducts\.length < 4 \? "product-grid-sparse-v412" : ""/,
  );
  assert.match(
    catalog,
    /kind === "shop" && uncategorized\.length < 4 \? "product-grid-sparse-v412" : ""/,
  );
});

test("sparse shop cards stop stretching vertically", () => {
  assert.match(css, /Ichigo Ichie V4\.12 — Compact sparse product rows/);
  assert.match(css, /product-grid-sparse-v412 \.product-card-compact\s*\{[\s\S]*?height:\s*auto;/);
  assert.match(css, /product-grid-sparse-v412 \.product-card-compact\s*\{[\s\S]*?align-self:\s*start;/);
  assert.match(css, /product-grid-sparse-v412 \.product-card-compact \.product-copy\s*\{[\s\S]*?flex:\s*0 0 auto;/);
});

test("sparse shop CTA follows content instead of being pushed through empty space", () => {
  assert.match(css, /product-grid-sparse-v412 \.product-card-compact \.product-card-meta\s*\{[\s\S]*?margin-bottom:\s*0;/);
  assert.match(css, /product-grid-sparse-v412 \.product-card-compact \.product-card-cta\s*\{[\s\S]*?margin-top:\s*14px;/);
});

test("full storefront rows retain the existing equal-height alignment contract", () => {
  assert.match(alignment, /storefront product cards stretch their content to equal card height/);
  assert.match(alignment, /storefront CTA is pinned to the bottom of every product card/);
  assert.match(css, /\.product-card-compact\s*\{[\s\S]*?height:\s*100%;/);
  assert.match(css, /\.product-card-compact \.product-card-cta\s*\{[\s\S]*?margin-top:\s*auto;/);
});
