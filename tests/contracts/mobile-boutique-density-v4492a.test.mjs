import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
const css = readFileSync(resolve(process.cwd(), "src/app/styles/globals-04.css"), "utf8");
const marker = "/* Ichigo Ichie V4.49.2a — Mobile visual safety fix */";
const start = css.indexOf(marker);
assert.ok(start >= 0);
const block = css.slice(start);
test("V449.2a is mobile-scoped", () => assert.ok(block.includes("@media (max-width: 760px)")));
test("V449.2a prevents destructive packaging crop", () => assert.ok(block.includes("object-fit: contain !important;")));
test("V449.2a centers packaging", () => assert.ok(block.includes("object-position: center center !important;")));
test("V449.2a leaves commerce actions unchanged", () => {
  assert.equal(block.includes("product-card-cta"), false);
  assert.equal(block.includes("product-stock-card"), false);
});
