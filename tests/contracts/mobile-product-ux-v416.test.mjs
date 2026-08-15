import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const v415 = readFileSync(resolve(root, "tests/contracts/product-title-modal-v415.test.mjs"), "utf8");

test("mobile product cards release legacy content min-heights", () => {
  assert.match(css, /Ichigo Ichie V4\.16 — Mobile product interaction polish/);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*product-card-description,[\s\S]*product-card-meta,[\s\S]*product-card-meta p[\s\S]*min-height:\s*0;/,
  );
  assert.match(css, /product-card-compact \.product-card-meta\s*\{[\s\S]*?justify-content:\s*flex-start;/);
});

test("mobile clickable product title has a full touch target and keeps two-line truncation", () => {
  assert.match(v415, /product-title-button-v415/);
  assert.match(
    css,
    /product-title-button-v415\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*44px;[\s\S]*?-webkit-line-clamp:\s*2;[\s\S]*?touch-action:\s*manipulation;/,
  );
  assert.match(
    css,
    /product-title-row h3\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-width:\s*0;/,
  );
});

test("mobile product card primary actions keep comfortable touch targets", () => {
  assert.match(
    css,
    /product-card-compact \.product-image-button,[\s\S]*product-card-compact \.product-card-cta\s*\{[\s\S]*?touch-action:\s*manipulation;/,
  );
  assert.match(css, /product-card-compact \.product-card-cta\s*\{[\s\S]*?min-height:\s*50px;/);
});

test("mobile product modal controls remain easy to tap without changing modal layout", () => {
  assert.match(
    css,
    /product-modal-v28 \.modal-close,[\s\S]*product-modal-v28 \.gallery-arrow\s*\{[\s\S]*?width:\s*44px !important;[\s\S]*?height:\s*44px !important;/,
  );
  assert.match(css, /product-modal-v28 \.product-buy-button\s*\{[\s\S]*?min-height:\s*54px !important;/);
  assert.match(css, /product-modal-v28 \.product-detail-scroll\s*\{[\s\S]*?-webkit-overflow-scrolling:\s*touch;/);
});
