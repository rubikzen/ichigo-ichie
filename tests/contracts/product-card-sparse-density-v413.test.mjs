import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const baseCss = readFileSync(resolve(root, "src/app/styles/globals-01.css"), "utf8");
const v412 = readFileSync(resolve(root, "tests/contracts/product-card-sparse-grid-v412.test.mjs"), "utf8");

test("V413 releases sparse desktop description height reserved by legacy cards", () => {
  assert.match(css, /Ichigo Ichie V4\.13 — Sparse card inner density/);
  assert.match(
    css,
    /@media \(min-width: 821px\)[\s\S]*product-grid-sparse-v412[\s\S]*product-card-description[\s\S]*min-height:\s*0;/,
  );
  assert.match(baseCss, /\.product-copy p\{[^}]*min-height:42px/);
});

test("sparse desktop meta follows content instead of reserving an empty block", () => {
  assert.match(
    css,
    /product-grid-sparse-v412 \.product-card-compact \.product-card-meta\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?justify-content:\s*flex-start;/,
  );
  assert.match(
    css,
    /product-grid-sparse-v412 \.product-card-compact \.product-card-meta\s*\{[\s\S]*?margin-top:\s*12px;[\s\S]*?margin-bottom:\s*0;/,
  );
});

test("sparse desktop stock paragraphs no longer inherit legacy paragraph min-height", () => {
  assert.match(
    css,
    /product-grid-sparse-v412 \.product-card-compact \.product-card-meta p\s*\{[\s\S]*?min-height:\s*0;/,
  );
  assert.match(
    css,
    /product-grid-sparse-v412 \.product-card-compact \.product-stock-card\s*\{[\s\S]*?margin-top:\s*0;[\s\S]*?margin-bottom:\s*0;/,
  );
});

test("V413 preserves V412 sparse targeting and keeps the final CTA gap compact", () => {
  assert.match(v412, /product-grid-sparse-v412/);
  assert.match(v412, /full storefront rows retain the existing equal-height alignment contract/);
  assert.match(
    css,
    /product-grid-sparse-v412 \.product-card-compact \.product-card-cta\s*\{[\s\S]*?margin-top:\s*12px;/,
  );
});
