import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync("src/components/ShopCollectionContent.tsx", "utf8");
const island = fs.readFileSync("src/components/ShopCollectionProducts.tsx", "utf8");

assert.match(shell, /import dynamic from "next\/dynamic"/);
assert.match(
  shell,
  /import\("@\/components\/ShopCollectionProducts"\)\.then\(/,
);
assert.doesNotMatch(shell, /import \{ ProductCard \}/);
assert.doesNotMatch(shell, /import \{ ReviewSummaryProvider \}/);
assert.doesNotMatch(shell, /useState<SortMode>/);
assert.match(shell, /<ShopCollectionProducts products=\{products\} \/>/);

assert.match(island, /^"use client";/);
assert.match(island, /import \{ ProductCard \}/);
assert.match(island, /import \{ ReviewSummaryProvider \}/);
assert.match(island, /const \[sortMode, setSortMode\] = useState<SortMode>/);
assert.match(island, /<ReviewSummaryProvider productIds=\{sortedProducts\.map/);
assert.match(island, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
assert.match(island, /value="price-asc"/);
assert.match(island, /value="price-desc"/);
assert.match(island, /value="name-asc"/);
assert.match(island, /value="name-desc"/);

console.log("V500 boutique products island contract passed");
