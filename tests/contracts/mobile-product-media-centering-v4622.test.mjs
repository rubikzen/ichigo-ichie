import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

const marker = "/* Ichigo Ichie V4.62.2 — Mobile product media centering */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V462.2 CSS marker must exist");
const block = css.slice(start);

test("V462.2 anchors mobile product media to the complete card image stage", () => {
  assert.match(block, /\.product-image-button/);
  assert.match(block, /position: relative !important/);
  assert.match(block, /place-items: center !important/);
});

test("V462.2 centers the actual product image independently of intrinsic dimensions", () => {
  assert.match(block, /\.product-image \{/);
  assert.match(block, /position: absolute !important/);
  assert.match(block, /inset: 0 !important/);
  assert.match(block, /width: 100% !important/);
  assert.match(block, /height: 100% !important/);
  assert.match(block, /object-position: center center !important/);
});

test("V462.2 preserves contain mode so packaging is not destructively cropped", () => {
  assert.match(block, /object-fit: contain !important/);
  assert.doesNotMatch(block, /object-fit: cover/);
});

test("V462.2 keeps badges above media without commerce or schema changes", () => {
  assert.match(block, /\.badge,/);
  assert.match(block, /\.photo-count/);
  assert.match(block, /z-index: 2/);
  assert.doesNotMatch(block, /create table/i);
  assert.doesNotMatch(block, /alter table/i);
});
