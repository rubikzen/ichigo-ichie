import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const menuCard = src("src/components/MenuInfoCard.tsx");
const catalog = src("src/components/UnifiedCatalogSections.tsx");

test("V495 lets the browser skip layout and paint for offscreen compact menu cards", () => {
  assert.match(menuCard, /contentVisibility: "auto"/);
  assert.match(menuCard, /containIntrinsicSize: "auto 112px"/);
  assert.match(menuCard, /style=\{compact \? compactRenderStyle : undefined\}/);
});

test("V495 keeps the optimization scoped to compact homepage menu cards", () => {
  assert.match(menuCard, /compact = false/);
  assert.match(menuCard, /menu-info-card-compact-v449/);
  assert.match(menuCard, /loading="lazy"/);
});

test("V495 preserves the full menu catalog and anchor in the homepage render tree", () => {
  assert.match(catalog, /import \{ MenuInfoCard \} from "\.\/MenuInfoCard"/);
  assert.match(catalog, /<CatalogBlock id="menu" kind="menu"/);
  assert.doesNotMatch(catalog, /IntersectionObserver/);
  assert.doesNotMatch(catalog, /menuMounted/);
});
