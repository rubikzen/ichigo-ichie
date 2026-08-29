import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const compact = src("src/lib/home-catalog.ts");
const reviews = src("src/components/ReviewSummaryProvider.tsx");
const globals = src("src/app/globals.css");
const performanceCss = src("src/app/styles/performance-v486.css");

test("V486 compacts homepage menu data before crossing the server/client boundary", () => {
  assert.match(page, /compactMenuProductForHome/);
  assert.match(page, /menu\.products\.map\(compactMenuProductForHome\)/);
  assert.match(page, /menuProducts=\{compactMenuProducts\}/);
  assert.match(compact, /variants: \[\]/);
  assert.match(compact, /option_groups: \[\]/);
  assert.match(compact, /ideal_for: \[\]/);
  assert.match(compact, /firstSortedImage\(product\.images\)/);
  assert.doesNotMatch(compact, /long_description_fr:/);
  assert.doesNotMatch(compact, /food_info:/);
});

test("V486 keeps review merchandising off the initial LCP path", () => {
  assert.match(reviews, /requestIdleCallback/);
  assert.match(reviews, /timeout: 1200/);
  assert.match(reviews, /setTimeout\(\(\) => void load\(\), 350\)/);
  assert.match(reviews, /AbortController/);
  assert.match(reviews, /signal: controller\.signal/);
});

test("V486 lets supporting browsers skip initial layout and paint for below-fold homepage sections", () => {
  assert.match(globals, /performance-v486\.css/);
  assert.match(performanceCss, /@supports \(content-visibility: auto\)/);
  assert.match(performanceCss, /\.onepage-catalog-menu/);
  assert.match(performanceCss, /\.matcha-guides-teaser-v469/);
  assert.match(performanceCss, /\.house-section-v226/);
  assert.match(performanceCss, /\.contact-section-v228/);
  assert.match(performanceCss, /content-visibility: auto/);
  assert.match(performanceCss, /contain-intrinsic-size: auto/);
});
