import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const home = src("src/components/HomePageContent.tsx");
const homeCss = src("src/app/styles/home-mobile-v492.css");
const productCard = src("src/components/ProductCard.tsx");
const productModal = src("src/components/ProductDetailModal.tsx");

test("V492 keeps homepage mobile CSS out of the hydrated component", () => {
  assert.match(page, /import "\.\/styles\/home-mobile-v492\.css"/);
  assert.doesNotMatch(home, /<style jsx global>/);
  assert.match(homeCss, /\.hero-mobile-v260/);
  assert.match(homeCss, /@media \(max-width: 760px\)/);
});

test("V492 avoids serializing featured products twice across the RSC boundary", () => {
  assert.match(page, /shopFeaturedIds/);
  assert.match(page, /\.map\(\(product\) => product\.id\)/);
  assert.match(home, /shopFeaturedIds: string\[\]/);
  assert.match(home, /shopProductsById/);
  assert.doesNotMatch(page, /shopFeatured=\{shopFeatured\}/);
});

test("V492 splits modal rendering out of the initial ProductCard module", () => {
  assert.match(productCard, /dynamic\(/);
  assert.match(productCard, /import\("\.\/ProductDetailModal"\)/);
  assert.match(productCard, /ssr: false/);
  assert.doesNotMatch(productCard, /createPortal/);
  assert.match(productModal, /createPortal/);
  assert.match(productModal, /closeButtonRef\.current\?\.focus\(\)/);
});
