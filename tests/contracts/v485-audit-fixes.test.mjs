import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const matchaNice = src("src/app/matcha-nice/page.tsx");
const reviewSummary = src("src/app/api/reviews/summary/route.ts");

test("V485 Matcha Nice limits Boutique recommendations to matcha products", () => {
  assert.match(
    matchaNice,
    /product\.type === "product" && searchableMatcha\(product\)/,
  );
  assert.match(matchaNice, /name: "Sélection de matchas Ichigo Ichie à Nice"/);
});

test("V485 review summaries keep client validation errors explicit but fail soft on backend outages", () => {
  assert.match(reviewSummary, /publicApiErrorInfo\(error\)/);
  assert.match(reviewSummary, /status: publicError\.status/);
  assert.match(reviewSummary, /Review summary API unavailable/);
  assert.match(reviewSummary, /\{ summaries: \{\} \}/);
  assert.doesNotMatch(reviewSummary, /console\.error\("Review summary API failed"/);
});
