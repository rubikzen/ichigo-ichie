import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const nav = src("src/components/MobileBottomNav.tsx");
const header = src("src/components/SiteHeader.tsx");
const card = src("src/components/ProductCard.tsx");
const css = src("src/app/styles/globals-04.css");

const marker = "/* V479.2 — Mobile storefront interaction polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V479.2 CSS marker must exist");
const v4792 = css.slice(start);

test("V479.2 bottom dock reacts to scroll direction instead of covering products continuously", () => {
  assert.match(nav, /dockHiddenByScroll/);
  assert.match(nav, /const delta = nextY - lastY/);
  assert.match(nav, /delta > 12/);
  assert.match(nav, /delta < -10/);
  assert.match(nav, /requestAnimationFrame\(updateDockVisibility\)/);
});

test("V479.2 always restores the dock near page boundaries", () => {
  assert.match(nav, /const nearTop = nextY < 180/);
  assert.match(nav, /document\.documentElement\.scrollHeight - 180/);
  assert.match(nav, /if \(nearTop \|\| nearBottom\)/);
  assert.match(nav, /setDockHiddenByScroll\(false\)/);
});

test("V479.2 preserves all five existing mobile navigation destinations", () => {
  for (const href of [
    'href="/#boutique"',
    'href="/#menu"',
    'href="/#maison"',
    'href="/compte"',
    'href="/panier"',
  ]) {
    assert.ok(nav.includes(href), `missing ${href}`);
  }
  assert.match(nav, /mobile-bottom-nav-v225/);
  assert.match(nav, /mobile-bottom-nav-v236/);
});

test("V479.2 scroll-hidden dock moves outside the viewport and remains focus-recoverable", () => {
  assert.match(v4792, /\.mobile-bottom-nav-v4792\.is-scroll-hidden-v4792/);
  assert.match(v4792, /transform: translateY/);
  assert.match(v4792, /pointer-events: none/);
  assert.match(
    v4792,
    /\.mobile-bottom-nav-v4792\.is-scroll-hidden-v4792:focus-within/,
  );
});

test("V479.2 makes the existing scrolled header a 52px utility bar only on mobile", () => {
  assert.match(header, /scrolled \? " is-scrolled" : ""/);
  assert.match(v4792, /@media \(max-width: 760px\)/);
  assert.match(
    v4792,
    /\.site-header-v261\.is-scrolled \{[\s\S]*?min-height: 52px !important;[\s\S]*?height: 52px !important;/,
  );
  assert.match(v4792, /\.brand-v224 img \{[\s\S]*?width: 28px !important/);
});

test("V479.2 adds a canonical title link while preserving the historical modal title trigger", () => {
  assert.match(card, /className="product-title-button-v415"/);
  assert.match(card, /openProductDetails\(event\.currentTarget\)/);
  assert.match(card, /className="product-title-link-v4792"/);
  assert.match(
    card,
    /href=\{`\/boutique\/\$\{encodeURIComponent\(product\.slug\.trim\(\)\.toLowerCase\(\)\)\}`\}/,
  );
});

test("V479.2 mobile two-column homepage cards use title as product-page entry and remove duplicate permalink line", () => {
  assert.match(
    v4792,
    /\.onepage-catalog-shop[\s\S]*?\.product-title-button-v415 \{\s*display: none !important;/,
  );
  assert.match(
    v4792,
    /\.onepage-catalog-shop[\s\S]*?\.product-title-link-v4792 \{[\s\S]*?display: -webkit-box;/,
  );
  assert.match(
    v4792,
    /\.onepage-catalog-shop[\s\S]*?\.product-permalink-v431 \{\s*display: none !important;/,
  );
});

test("V479.2 applies the same title hierarchy to canonical mobile collection cards", () => {
  assert.match(
    v4792,
    /\.shop-collection-grid-v473[\s\S]*?\.product-title-link-v4792 \{[\s\S]*?display: -webkit-box;/,
  );
  assert.match(
    v4792,
    /\.shop-collection-grid-v473[\s\S]*?\.product-permalink-v431 \{\s*display: none !important;/,
  );
});

test("V479.2 stabilizes compact-card information height without inflating the whole card", () => {
  assert.match(v4792, /\.product-title-row \{[\s\S]*?min-height: 43px/);
  assert.match(v4792, /\.product-card-meta \{[\s\S]*?min-height: 58px/);
  assert.match(v4792, /\.product-stock-card \{[\s\S]*?min-height: 18px/);
});

test("V479.2 leaves ProductCard cart stock restock modal and tracking behavior untouched", () => {
  assert.match(card, /const stockLimitReached =/);
  assert.match(card, /const handleAdd = \(\) =>/);
  assert.match(card, /addItem\(/);
  assert.match(card, /setQuantity\(/);
  assert.match(card, /removeItem\(/);
  assert.match(card, /RestockNotify/);
  assert.match(card, /product-modal product-modal-v28/);
  assert.match(card, /trackConversion\(/);
});

test("V479.2 respects reduced motion and adds no database checkout or schema mutation", () => {
  assert.match(v4792, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(v4792, /transition: none !important/);
  assert.doesNotMatch(v4792, /supabase|checkout|stripe|order_items|orders/);
  assert.doesNotMatch(v4792, /"@type":/);
  assert.doesNotMatch(nav, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
