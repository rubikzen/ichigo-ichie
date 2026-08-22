import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const collection = src("src/components/ShopCollectionContent.tsx");
const explore = src("src/components/MatchaExploreNav.tsx");
const productCard = src("src/components/ProductCard.tsx");
const css = src("src/app/styles/globals-04.css");

test("V478 gives category and usage distinct hierarchy without changing clean collection links", () => {
  assert.match(collection, /shop-collection-taxonomy-row-v478/);
  assert.match(collection, /shop-collection-taxonomy-label-v478/);
  assert.match(collection, /\{fr \? "Catégorie" : "Category"\}/);
  assert.match(collection, /\{fr \? "Usage" : "Use"\}/);
  assert.match(collection, /categoryCollectionPath\(category\)/);
  assert.match(collection, /MATCHA_INTENT_SUMMARIES\.map/);
  assert.doesNotMatch(collection, /\?category=|\?usage=/);
});

test("V478 desktop hero keeps editorial content while removing the stranded right-column layout", () => {
  assert.match(collection, /shop-collection-hero-copy-v478/);
  assert.match(css, /\.shop-collection-hero-v473 \{\s*display: block;/);
  assert.match(
    css,
    /\.shop-collection-hero-links-v473 \{[\s\S]*?flex-direction: row;/,
  );
  assert.match(collection, /Guides du matcha →/);
  assert.match(collection, /Boutique à Nice →/);
});

test("V478 mobile collection path visually removes breadcrumb and compacts hero without deleting semantic source", () => {
  assert.match(collection, /<SeoBreadcrumbs/);
  assert.match(css, /\.shop-collection-breadcrumb-v473 \{\s*display: none;/);
  assert.match(css, /-webkit-line-clamp: 4/);
  assert.match(
    css,
    /font-size: clamp\(2\.15rem, 10\.2vw, 2\.9rem\)/,
  );
});

test("V478 mobile count and sort share one compact row before products", () => {
  assert.match(collection, /shop-collection-count-v478/);
  assert.match(collection, /shop-collection-sort-v478/);
  assert.match(
    css,
    /\.shop-collection-toolbar-v473 \{[\s\S]*?flex-direction: row;[\s\S]*?justify-content: space-between;/,
  );
  assert.match(css, /\.shop-collection-sort-v478 > span \{\s*display: none;/);
  assert.match(collection, /setSortMode\(event\.target\.value as SortMode\)/);
});

test("V478 makes horizontal discovery overflow intentional and centers active mobile destination", () => {
  assert.match(explore, /useEffect, useRef/);
  assert.match(explore, /activeLinkRef/);
  assert.match(explore, /window\.matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(explore, /scroller\.scrollTo/);
  assert.match(explore, /ref=\{item\.active \? activeLinkRef : undefined\}/);
  assert.match(css, /mask-image: linear-gradient/);
  assert.match(css, /scroll-padding-inline: 12px/);
});

test("V478 reserves floating bottom-navigation clearance without moving historical dock destinations", () => {
  assert.match(
    css,
    /var\(--mobile-nav-space, 94px\)[\s\S]*?env\(safe-area-inset-bottom, 0px\)/,
  );
  assert.doesNotMatch(collection, /mobile-bottom-nav/);
  assert.doesNotMatch(explore, /mobile-bottom-nav/);
});

test("V478 keeps products on existing ProductCard and one batch review provider", () => {
  assert.match(collection, /<ReviewSummaryProvider/);
  assert.match(
    collection,
    /<ProductCard key=\{product\.id\} product=\{product\} \/>/,
  );
  assert.match(productCard, /export function ProductCard/);
  assert.doesNotMatch(collection, /addItem\(|setQuantity\(/);
});

test("V478 does not turn local sort or taxonomy into crawlable query-state facets", () => {
  assert.match(collection, /const \[sortMode, setSortMode\] = useState/);
  assert.doesNotMatch(
    collection,
    /useSearchParams|router\.push|history\.pushState|\?sort=/,
  );
});

test("V478 is presentation-only with no commerce schema or database mutation", () => {
  const combined = [collection, explore].join("\n");
  assert.match(css, /V478 — Boutique collection UI polish/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 390px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(
    combined,
    /from\("orders"\)|from\("order_items"\)|checkout|stripe/i,
  );
  assert.doesNotMatch(combined, /"@type": "Product"|"@type": "Offer"/);
});
