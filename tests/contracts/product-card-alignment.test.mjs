import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const css = readFileSync(
  resolve(process.cwd(), "src/app/styles/globals-04.css"),
  "utf8",
);

test("storefront product cards stretch their content to equal card height", () => {
  assert.match(
    css,
    /\.product-card-compact\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;/,
  );
  assert.match(
    css,
    /\.product-card-compact \.product-copy\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?flex-direction:\s*column;/,
  );
});

test("storefront CTA is pinned to the bottom of every product card", () => {
  assert.match(
    css,
    /\.product-card-compact \.product-card-cta\s*\{[\s\S]*?margin-top:\s*auto;/,
  );
});
