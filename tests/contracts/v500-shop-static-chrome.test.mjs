import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const chrome = src("src/components/ShopCollectionContent.tsx");
const products = src("src/components/ShopCollectionProducts.tsx");
const languageCss = src("src/components/ShopCollectionContent.module.css");

test("V500 keeps boutique chrome out of the client component graph", () => {
  assert.doesNotMatch(chrome, /^"use client";/m);
  assert.doesNotMatch(chrome, /useLanguage/);
  assert.doesNotMatch(chrome, /useState|useMemo|useCallback/);
  assert.doesNotMatch(chrome, /ProductCard|ReviewSummaryProvider/);
  assert.match(chrome, /<ShopCollectionProducts products=\{products\} \/>/);
});

test("V500 isolates sorting and product-card hydration behind one client boundary", () => {
  assert.match(products, /^"use client";/m);
  assert.match(products, /useLanguage/);
  assert.match(products, /useState<SortMode>/);
  assert.match(products, /ReviewSummaryProvider/);
  assert.match(products, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
});

test("V500 preserves FR and EN static chrome without React hydration", () => {
  assert.match(chrome, /function LocalizedText/);
  assert.match(chrome, /ICHIGO ICHIE · SÉLECTION JAPONAISE/);
  assert.match(chrome, /ICHIGO ICHIE · JAPANESE SELECTION/);
  assert.match(languageCss, /html\[data-language="fr"\]/);
  assert.match(languageCss, /html\[data-language="en"\]/);
});
