import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/components/ProductPageContent.tsx");
const card = src("src/components/ProductCard.tsx");
const reviews = src("src/components/ProductReviews.tsx");
const css = src("src/app/styles/globals-04.css");
const e2e = src("tests/e2e/product-page-v431.spec.ts");

const marker =
  "/* V480 — Product detail page visual and conversion polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V480 CSS marker must exist");
const v481Boundary = css.indexOf("/* V481 — Cart & checkout conversion polish */", start + 1);
const v480 = css.slice(start, v481Boundary >= 0 ? v481Boundary : undefined);

test("V480 adds a dedicated product-page presentation surface without replacing V431 V432 or V459", () => {
  assert.match(
    page,
    /product-page-v431 product-page-v432 product-page-v459 product-page-v480/,
  );
  assert.match(page, /data-product-page-v431/);
  assert.match(page, /data-product-page-v432/);
  assert.match(page, /data-product-page-v459/);
  assert.match(page, /data-product-page-v480/);
});

test("V480 keeps gallery and purchase as the two primary hero columns on desktop", () => {
  assert.match(page, /product-page-gallery-v432 product-page-gallery-v480/);
  assert.match(page, /product-page-side-v432 product-page-side-v480/);
  assert.match(
    v480,
    /grid-template-columns: minmax\(0, 1\.18fr\) minmax\(350px, 0\.82fr\)/,
  );
  assert.match(v480, /gap: clamp\(24px, 4vw, 54px\)/);
});

test("V480 presents packaging photography without destructive cropping", () => {
  assert.match(v480, /\.product-page-gallery-stage-v432 > img/);
  assert.match(v480, /object-fit: contain !important/);
  assert.match(v480, /object-position: center center !important/);
  assert.match(v480, /#f2f2e8/);
});

test("V480 makes only the desktop purchase box sticky and releases it on tablet/mobile", () => {
  assert.match(
    v480,
    /\.product-page-buy-box-v480 \{[\s\S]*?position: sticky;[\s\S]*?top: 92px;/,
  );
  assert.match(v480, /@media \(max-width: 860px\)/);
  assert.match(
    v480,
    /\.product-page-buy-box-v480 \{[\s\S]*?position: static;[\s\S]*?top: auto;/,
  );
});

test("V480 removes duplicated storefront editorial only inside the embedded purchase console", () => {
  assert.match(
    v480,
    /\.product-page-purchase-v480[\s\S]*?\.product-title-row[\s\S]*?h3 \{\s*display: none !important;/,
  );
  assert.match(
    v480,
    /\.product-page-purchase-v480[\s\S]*?\.product-card-description,[\s\S]*?\.product-permalink-v431,[\s\S]*?\.product-merchandising-v462 \{\s*display: none !important;/,
  );
  assert.match(
    v480,
    /\.product-page-purchase-v480[\s\S]*?\.product-card-price/,
  );
  assert.match(
    v480,
    /\.product-page-purchase-v480[\s\S]*?\.product-card-cta/,
  );
});

test("V480 preserves ProductCard as the sole purchase engine", () => {
  assert.match(page, /<ProductCard product=\{product\} \/>/);
  assert.doesNotMatch(page, /addItem\(/);
  assert.doesNotMatch(page, /setQuantity\(/);
  assert.doesNotMatch(page, /removeItem\(/);
  assert.doesNotMatch(page, /RestockNotify/);
  assert.match(card, /const canAdd =/);
  assert.match(card, /addItem\(/);
  assert.match(card, /<RestockNotify/);
});

test("V480 moves facts after the hero into a dedicated glanceable section", () => {
  const purchase = page.indexOf('id="product-purchase-v459"');
  const heroEnd = page.indexOf("product-page-facts-section-v480");
  assert.ok(purchase >= 0 && heroEnd > purchase);

  assert.match(page, /product-page-facts-title-v480/);
  assert.match(page, /Le produit en un coup d’œil/);
  assert.match(page, /The product at a glance/);
  assert.match(page, /product-page-facts-v480/);
  assert.match(page, /product\.origin/);
  assert.match(page, /product\.cultivar/);
  assert.match(page, /product\.ideal_for/);
});

test("V480 keeps long editorial copy guides and reviews in one coherent page shell", () => {
  assert.match(page, /product-page-description-v480/);
  assert.match(page, /product-page-guides-v480/);
  assert.match(page, /<ProductGuideLinks product=\{product\} \/>/);
  assert.match(page, /product-page-reviews-shell-v480/);
  assert.match(page, /<ProductReviews productId=\{product\.id\} \/>/);
  assert.match(reviews, /id="avis"/);
});

test("V480 mobile path remains conversion-first and clears the fixed navigation", () => {
  assert.match(page, /product-page-mobile-buy-link-v459/);
  assert.match(page, /href="#product-purchase-v459"/);
  assert.match(v480, /@media \(max-width: 560px\)/);
  assert.match(
    v480,
    /var\(--mobile-nav-space, 94px\)[\s\S]*?env\(safe-area-inset-bottom, 0px\)/,
  );
  assert.match(v480, /-webkit-line-clamp: 4/);
  assert.match(v480, /min-height: 56px/);
});

test("V480 preserves review commerce-independent behavior and canonical E2E coverage", () => {
  assert.match(reviews, /Secondary content: never block product purchase/);
  assert.match(e2e, /main\[data-product-page-v431\]/);
  assert.match(e2e, /main\[data-product-page-v432\]/);
  assert.match(e2e, /product-page-gallery-v432/);
  assert.match(e2e, /product-page-purchase-v432 \.product-image-button/);
  assert.doesNotMatch(e2e, /request\.post/);
});

test("V480 is responsive presentation-only with no database checkout pricing or schema mutation", () => {
  assert.match(v480, /@media \(max-width: 860px\)/);
  assert.match(v480, /@media \(max-width: 560px\)/);
  assert.match(v480, /prefers-reduced-motion/);

  assert.doesNotMatch(page, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(page, /checkout|stripe|order_items|orders/i);
  assert.doesNotMatch(page, /"@type":/);
  assert.doesNotMatch(v480, /supabase|checkout|stripe|order_items|orders/);
});
