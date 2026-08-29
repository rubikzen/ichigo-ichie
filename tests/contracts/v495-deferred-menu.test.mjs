import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const catalog = src("src/components/UnifiedCatalogSections.tsx");

test("V495 defers the homepage menu catalog until it approaches the viewport", () => {
  assert.match(catalog, /const \[menuMounted, setMenuMounted\] = useState\(false\)/);
  assert.match(catalog, /new IntersectionObserver/);
  assert.match(catalog, /rootMargin: "800px 0px"/);
  assert.match(catalog, /menuMounted \? \(\s*<CatalogBlock id="menu"/);
  assert.match(catalog, /ref=\{menuSentinelRef\}/);
  assert.match(catalog, /id="menu"/);
});

test("V495 keeps menu cards out of the initial homepage client bundle", () => {
  assert.match(catalog, /dynamic\(/);
  assert.match(catalog, /import\("\.\/MenuInfoCard"\)/);
  assert.match(catalog, /\{ ssr: false \}/);
  assert.doesNotMatch(catalog, /import \{ MenuInfoCard \} from "\.\/MenuInfoCard"/);
});

test("V495 preserves the shop catalog as the immediately rendered catalog", () => {
  assert.match(catalog, /<CatalogBlock id="boutique" kind="shop"/);
  assert.match(catalog, /<RitualBundleBuilder products=\{products\} \/>/);
});
