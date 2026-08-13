import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("Boutique intentionally has no product search UI", () => {
  assert.doesNotMatch(catalog, /type="search"/);
  assert.doesNotMatch(catalog, /normalizeCatalogSearch/);
  assert.doesNotMatch(catalog, /productSearchText/);
  assert.doesNotMatch(catalog, /searchQuery/);
  assert.doesNotMatch(catalog, /catalog-search-row-v382/);
});

test("Boutique category filters remain available and accessible", () => {
  assert.match(catalog, /activeCategory === "all"/);
  assert.match(catalog, /product\.category_id === activeCategory/);
  assert.match(catalog, /aria-pressed=\{activeCategory === "all"\}/);
  assert.match(catalog, /aria-pressed=\{activeCategory === category\.id\}/);
});

test("Boutique sorting remains available and accessible", () => {
  assert.match(catalog, /value="recommended"/);
  assert.match(catalog, /value="price-asc"/);
  assert.match(catalog, /value="price-desc"/);
  assert.match(catalog, /value="name-asc"/);
  assert.match(catalog, /value="name-desc"/);
  assert.match(catalog, /aria-label=\{labels\.sort\}/);
});

test("obsolete v382 search styling is fully removed", () => {
  assert.doesNotMatch(css, /Ichigo Ichie V3\.82 — Boutique search and filter polish/);
  assert.doesNotMatch(css, /catalog-search-v382/);
  assert.doesNotMatch(css, /catalog-result-count-v382/);
  assert.doesNotMatch(catalog, /boutique-toolbar-v382/);
});
