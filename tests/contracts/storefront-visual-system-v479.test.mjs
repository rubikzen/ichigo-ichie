import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const css = src("src/app/styles/globals-04.css");
const card = src("src/components/ProductCard.tsx");
const collection = src("src/components/ShopCollectionContent.tsx");
const header = src("src/components/SiteHeader.tsx");

const marker =
  "/* V479 — Storefront visual system and premium product cards */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V479 CSS marker must exist");
const v479 = css.slice(start);

test("V479 defines a restrained reusable storefront card visual system", () => {
  assert.match(v479, /--store-card-radius-v479/);
  assert.match(v479, /--store-card-border-v479/);
  assert.match(v479, /--store-card-shadow-v479/);
  assert.match(v479, /--store-media-v479/);
  assert.match(
    v479,
    /\.product-card\.product-card-compact \{[\s\S]*?border-radius: var\(--store-card-radius-v479\)/,
  );
});

test("V479 keeps the whole package visible inside a consistent media frame", () => {
  assert.match(
    v479,
    /\.product-image-button > \.product-image \{[\s\S]*?object-fit: contain !important;[\s\S]*?object-position: center center !important;/,
  );
  assert.match(
    v479,
    /@media \(min-width: 821px\)[\s\S]*?aspect-ratio: 4 \/ 5 !important;/,
  );
  assert.match(v479, /padding: 12px !important/);
});

test("V479 reduces card chrome while preserving premium title price rating and CTA hierarchy", () => {
  assert.match(v479, /\.product-title-row h3/);
  assert.match(v479, /\.product-card-price/);
  assert.match(v479, /\.product-card-rating-v4661/);
  assert.match(v479, /\.product-card-description/);
  assert.match(v479, /-webkit-line-clamp: 2/);
  assert.match(v479, /\.product-card-cta/);
});

test("V479 intentionally upgrades canonical mobile collections to two columns at useful widths", () => {
  assert.match(
    v479,
    /@media \(min-width: 360px\) and \(max-width: 640px\)/,
  );
  assert.match(
    v479,
    /\.shop-collection-grid-v473 \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important;/,
  );
  assert.match(collection, /product-grid shop-collection-grid-v473/);
});

test("V479 keeps very narrow devices on one column instead of crushing the cards", () => {
  assert.match(v479, /@media \(max-width: 359px\)/);
  assert.match(
    v479,
    /\.shop-collection-grid-v473 \{\s*grid-template-columns: 1fr !important;/,
  );
});

test("V479 two-column cards move long descriptive copy into modal/product page while retaining a canonical visible link", () => {
  assert.match(
    v479,
    /\.shop-collection-grid-v473[\s\S]*?\.product-card-description \{\s*display: none !important;/,
  );
  assert.match(card, /className="product-permalink-v431"/);
  assert.match(card, /Voir la page produit/);
  assert.match(card, /View product page/);
});

test("V479 keeps use and format signals but limits visual noise on two-column cards", () => {
  assert.match(v479, /\.product-merchandising-v462/);
  assert.match(v479, /span:nth-of-type\(n \+ 3\)/);
  assert.match(v479, /\.product-card-chips/);
  assert.match(v479, /span:nth-child\(n \+ 3\)/);
  assert.match(card, /productMatchaFinderTags\(product\)/);
  assert.match(card, /formatLabels/);
  assert.match(card, /packagingLabels/);
});

test("V479 compacts the mobile public header without removing language account or bottom navigation", () => {
  assert.match(v479, /@media \(max-width: 760px\)/);
  assert.match(
    v479,
    /\.site-header-v261 \{[\s\S]*?min-height: 62px !important;[\s\S]*?height: 62px !important;/,
  );
  assert.match(v479, /\.brand-v224 small \{\s*display: none !important;/);
  assert.match(header, /language-switch-mobile-visible-v261/);
  assert.match(header, /account-link-v243/);
  assert.match(header, /<MobileBottomNav \/>/);
});

test("V479 preserves all ProductCard commerce and accessibility behavior", () => {
  assert.match(
    card,
    /<article className="product-card product-card-compact">/,
  );
  assert.match(card, /const stockLimitReached =/);
  assert.match(card, /const handleAdd = \(\) =>/);
  assert.match(card, /addItem\(/);
  assert.match(card, /setQuantity\(/);
  assert.match(card, /removeItem\(/);
  assert.match(card, /RestockNotify/);
  assert.match(card, /product-modal product-modal-v28/);
  assert.match(card, /aria-label=\{name\}/);
});

test("V479 remains presentation-only with no database checkout stock-engine or schema mutation", () => {
  assert.doesNotMatch(v479, /supabase|checkout|stripe|order_items|orders/);
  assert.doesNotMatch(v479, /stock\s*[-+]=/);
  assert.doesNotMatch(v479, /"@type":/);
  assert.doesNotMatch(collection, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("V479 preserves reduced-motion accessibility for hover media polish", () => {
  assert.match(v479, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(v479, /transition: none !important/);
  assert.match(v479, /transform: none/);
});
