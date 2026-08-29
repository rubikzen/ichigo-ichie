import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const compact = src("src/lib/home-catalog.ts");
const shopProjection = compact.slice(compact.indexOf("export function compactShopProductForHome"));

test("V491 compacts shop products before they cross the homepage server/client boundary", () => {
  assert.match(page, /compactShopProductForHome/);
  assert.match(page, /shop\.products\.map\(compactShopProductForHome\)/);
  assert.match(page, /shopProducts=\{compactShopProducts\}/);
  assert.match(page, /highlightedShopProducts = compactShopProducts\.filter/);
});

test("V491 keeps storefront interactions while removing backend-only shop payload", () => {
  assert.match(shopProjection, /long_description_fr: product\.long_description_fr/);
  assert.match(shopProjection, /images: product\.images/);
  assert.match(shopProjection, /ideal_for: product\.ideal_for/);
  assert.match(shopProjection, /option_groups: product\.option_groups/);
  assert.match(shopProjection, /variants: product\.variants\.map/);
  assert.match(shopProjection, /food_info: null/);
  assert.doesNotMatch(shopProjection, /sku: variant\.sku/);
  assert.doesNotMatch(shopProjection, /shipping_weight_g: variant\.shipping_weight_g/);
  assert.doesNotMatch(shopProjection, /image_url: variant\.image_url/);
});
