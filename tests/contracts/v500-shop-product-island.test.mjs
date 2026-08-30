import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const shell = src("src/components/ShopCollectionContent.tsx");
const grid = src("src/components/ShopCollectionProductGrid.tsx");

test("V500 splits Boutique product interactions out of the collection shell", () => {
  assert.match(shell, /import dynamic from "next\/dynamic"/);
  assert.doesNotMatch(shell, /import \{ ProductCard \}/);
  assert.doesNotMatch(shell, /import \{ ReviewSummaryProvider \}/);
  assert.doesNotMatch(shell, /useState<SortMode>/);
  assert.match(
    shell,
    /dynamic\(\(\)\s*=>\s*import\("\.\/ShopCollectionProductGrid"\)\.then/,
  );
});

test("V500 preserves SSR and the existing collection product placement", () => {
  assert.doesNotMatch(shell, /ssr\s*:\s*false/);
  assert.match(
    shell,
    /<ShopCollectionProductGrid products=\{products\} language=\{language\} \/>/,
  );
});

test("V500 keeps sorting, reviews and ProductCard behavior inside the island", () => {
  assert.match(grid, /^"use client";/);
  assert.match(grid, /useState<SortMode>\("recommended"\)/);
  assert.match(grid, /<ReviewSummaryProvider/);
  assert.match(grid, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.match(grid, /value=\{sortMode\}/);
});
