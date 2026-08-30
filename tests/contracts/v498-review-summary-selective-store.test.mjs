import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const provider = src("src/components/ReviewSummaryProvider.tsx");
const productCard = src("src/components/ProductCard.tsx");

test("V498 keeps a single idle aggregate review request", () => {
  assert.match(provider, /fetch\("\/api\/reviews\/summary"/);
  assert.match(provider, /requestIdleCallback/);
  assert.match(provider, /JSON\.stringify\(\{ productIds: idsKey\.split\(","\) \}\)/);
});

test("V498 distributes summary changes through per-product subscriptions", () => {
  assert.match(provider, /createReviewSummaryStore/);
  assert.match(provider, /subscribe\(productId, listener\)/);
  assert.match(provider, /listeners\.get\(productId\)\?\.forEach/);
  assert.match(provider, /useSyncExternalStore\(subscribe, getSnapshot, \(\) => null\)/);
  assert.match(provider, /store\.replace\(data\.summaries \?\? \{\}\)/);
  assert.doesNotMatch(provider, /setSummaries/);
});

test("V498 preserves product-card rating rendering through the existing hook", () => {
  assert.match(productCard, /useProductReviewSummary\(product\.id\)/);
  assert.match(productCard, /product-card-rating-v4661/);
  assert.match(productCard, /reviewSummary\.average/);
  assert.match(productCard, /reviewSummary\.count/);
});
