import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const home = src("src/components/HomePageContent.tsx");

test("V497 sends only featured product IDs across the homepage RSC boundary", () => {
  assert.match(page, /const shopFeaturedIds =/);
  assert.match(page, /\.slice\(0, 3\)/);
  assert.match(page, /\.map\(\(product\) => product\.id\)/);
  assert.match(page, /shopFeaturedIds=\{shopFeaturedIds\}/);
  assert.doesNotMatch(page, /shopFeatured=\{shopFeatured\}/);
});

test("V497 resolves featured products from the already-sent compact shop catalog", () => {
  assert.match(home, /shopFeaturedIds: string\[\]/);
  assert.match(home, /new Map\(shopProducts\.map/);
  assert.match(home, /shopFeaturedIds\s*\.map\(\(id\) => shopProductsById\.get\(id\)\)/);
  assert.match(home, /<HomeFeatured products=\{shopFeatured\} \/>/);
});
