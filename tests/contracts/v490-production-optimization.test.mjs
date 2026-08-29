import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const trafficRoute = src("src/app/api/admin/analytics/traffic/route.ts");

test("V490 runs independent traffic analytics queries in parallel with lean payloads", () => {
  assert.match(trafficRoute, /await Promise\.all\(/);
  assert.match(
    trafficRoute,
    /\.select\("session_id,variant_id,transaction_ref"\)/,
  );
  assert.match(trafficRoute, /\.select\("session_id,product_id"\)/);
  assert.doesNotMatch(
    trafficRoute,
    /\.select\("session_id,occurred_at,path,variant_id,transaction_ref"\)/,
  );
});

test("V490 ranks product clicks before resolving only the top product names", () => {
  assert.match(trafficRoute, /const rankedProductClicks = \[\.\.\.clickBuckets\.entries\(\)\]/);
  assert.match(trafficRoute, /\.slice\(0, 10\);/);
  assert.match(
    trafficRoute,
    /const productIds = rankedProductClicks\.map\(\(\[productId\]\) => productId\);/,
  );
  assert.match(
    trafficRoute,
    /const topProductClicks = rankedProductClicks\.map/,
  );
});

test("V490 preserves the first-party traffic response contract", () => {
  for (const field of [
    "visits",
    "pageviews",
    "pagesPerVisit",
    "topCountries",
    "topCities",
    "totalProductClicks",
    "topProductClicks",
  ]) {
    assert.match(trafficRoute, new RegExp(`\\b${field}\\b`));
  }
});
