import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("Boutique has a local accent-insensitive product search", () => {
  assert.match(catalog, /function normalizeCatalogSearch/);
  assert.match(catalog, /\.normalize\("NFD"\)/);
  assert.match(catalog, /productSearchText\(product\)\.includes\(normalizedQuery\)/);
  assert.match(catalog, /type="search"/);
});

test("Boutique search covers useful product metadata", () => {
  assert.match(catalog, /product\.origin/);
  assert.match(catalog, /product\.cultivar/);
  assert.match(catalog, /product\.ideal_for/);
  assert.match(catalog, /variant\.name, variant\.weight/);
});

test("Boutique toolbar exposes result feedback and accessible filter state", () => {
  assert.match(catalog, /catalog-result-count-v382/);
  assert.match(catalog, /role="status" aria-live="polite"/);
  assert.match(catalog, /aria-pressed=\{activeCategory === "all"\}/);
  assert.match(catalog, /aria-pressed=\{activeCategory === category\.id\}/);
});

test("Boutique empty search can reset search category and sort together", () => {
  assert.match(catalog, /catalog-empty-v382/);
  assert.match(catalog, /setSearchQuery\(""\)/);
  assert.match(catalog, /setActiveCategory\("all"\)/);
  assert.match(catalog, /setSortMode\("recommended"\)/);
  assert.match(css, /Ichigo Ichie V3\.82 — Boutique search and filter polish/);
});
