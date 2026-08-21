import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const menu = readFileSync(resolve(root, "src/components/MenuInfoCard.tsx"), "utf8");
const home = readFileSync(resolve(root, "src/components/HomePageContent.tsx"), "utf8");
const catalog = readFileSync(resolve(root, "src/components/UnifiedCatalogSections.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

const marker = "/* Ichigo Ichie V4.61 — Storefront performance pass */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V461 CSS marker must exist");
const v461 = css.slice(start);

test("V461 reuses currency formatters across ProductCard renders", () => {
  assert.match(product, /const moneyFormatters =/);
  assert.match(product, /moneyFormatters\[language\]\.format\(value\)/);
});

test("V461 reuses currency formatters across compact Menu cards", () => {
  assert.match(menu, /const moneyFormatters =/);
  assert.match(menu, /moneyFormatters\[language\]\.format\(value\)/);
});

test("V461 keeps the homepage LCP hero eager while lazifying story media", () => {
  const heroStart = home.indexOf('className="hero-visual hero-visual-v224"');
  const storyStart = home.indexOf('className={`house-media-v226');
  assert.ok(heroStart >= 0 && storyStart > heroStart);
  const hero = home.slice(heroStart, storyStart);
  assert.match(hero, /priority/);
  assert.doesNotMatch(hero, /loading="lazy"/);
  assert.match(home.slice(storyStart), /loading="lazy"/);
});

test("V461 storefront ProductCard and Menu images are explicitly lazy", () => {
  assert.match(product, /className="product-image"[\s\S]*?loading="lazy"/);
  assert.match(menu, /sizes=\{[\s\S]*?loading="lazy"/);
});

test("V461 consolidates catalog refresh into one parent subscription", () => {
  const subscriptions = catalog.match(/subscribeCatalogUpdate\(\(\) => router\.refresh\(\)\)/g) ?? [];
  assert.equal(subscriptions.length, 1);
  const catalogBlock = catalog.slice(
    catalog.indexOf("function CatalogBlock"),
    catalog.indexOf("export function UnifiedCatalogSections"),
  );
  assert.doesNotMatch(catalogBlock, /const router = useRouter\(\)/);
});

test("V461 avoids repeated category membership scans for uncategorized products", () => {
  assert.match(catalog, /const categoryIds = useMemo/);
  assert.match(catalog, /new Set\(categories\.map/);
  assert.match(catalog, /!categoryIds\.has\(product\.category_id\)/);
});

test("V461 lets long offscreen storefront sections skip layout and paint progressively", () => {
  assert.match(v461, /@supports \(content-visibility: auto\)/);
  assert.match(v461, /\.premium-home-v224 \.onepage-category-group/);
  assert.match(v461, /content-visibility: auto/);
  assert.match(v461, /contain-intrinsic-size: auto 620px/);
  assert.match(v461, /\.premium-home-v224 \.house-section-v226/);
  assert.match(v461, /\.premium-home-v224 \.contact-section-v228/);
});

test("V461 is performance-only and avoids commerce or schema mutations", () => {
  assert.doesNotMatch(catalog, /addItem\(/);
  assert.doesNotMatch(catalog, /setQuantity\(/);
  assert.doesNotMatch(v461, /position:\s*fixed/);
  assert.doesNotMatch(v461, /display:\s*none/);
  assert.doesNotMatch(v461, /create table/i);
  assert.doesNotMatch(v461, /alter table/i);
});
