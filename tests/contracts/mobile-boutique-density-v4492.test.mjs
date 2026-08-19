import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8"
);
const card = readFileSync(
  resolve(root, "src/components/ProductCard.tsx"),
  "utf8"
);
const header = readFileSync(
  resolve(root, "src/components/SiteHeader.tsx"),
  "utf8"
);

const marker = "/* Ichigo Ichie V4.49.2 — Mobile Boutique density polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V449.2 CSS marker must exist");
const v4492 = css.slice(start);

test("V449.2 remains mobile-only and Shop-scoped for product density", () => {
  assert.ok(v4492.includes("@media (max-width: 760px)"));
  assert.ok(v4492.includes(".onepage-catalog-shop .product-card-compact"));
  assert.equal(v4492.includes("@media (min-width:"), false);
});

test("V449.2 shortens the mobile hero so commerce appears sooner", () => {
  assert.ok(v4492.includes("height: min(46dvh, 410px) !important;"));
  assert.ok(v4492.includes("min-height: 290px !important;"));
  assert.ok(v4492.includes("max-height: 410px !important;"));
});

test("V449.2 compacts only the scrolled mobile header state", () => {
  assert.ok(v4492.includes(".site-header-v261.is-scrolled"));
  assert.ok(v4492.includes("min-height: 62px !important;"));
  assert.ok(v4492.includes(".site-header-v261.is-scrolled .brand-v224 small"));
  assert.ok(header.includes('scrolled ? " is-scrolled" : ""'));
});

test("V449.2 reduces Shop product media without switching to a two-column marketplace", () => {
  assert.ok(
    v4492.includes(
      "height: clamp(245px, 67vw, 300px) !important;"
    )
  );
  assert.ok(v4492.includes("object-fit: cover !important;"));
  assert.equal(v4492.includes("grid-template-columns: repeat(2"), false);
});

test("V449.2 keeps premium card information while reducing vertical copy space", () => {
  assert.ok(v4492.includes("-webkit-line-clamp: 2 !important;"));
  assert.ok(v4492.includes("padding: 15px 16px 17px !important;"));
  assert.ok(v4492.includes("min-height: 28px !important;"));
  assert.ok(v4492.includes("margin-top: 8px !important;"));
});

test("V449.2 preserves product title price permalink variants stock and CTA markup", () => {
  assert.ok(card.includes('className="product-title-row"'));
  assert.ok(card.includes('className="product-card-price"'));
  assert.ok(card.includes('className="product-permalink-v431"'));
  assert.ok(card.includes('className="product-card-chips"'));
  assert.ok(card.includes("product-stock-card"));
  assert.ok(card.includes("product-card-cta"));
});

test("V449.2 keeps primary mobile purchase targets comfortably tappable", () => {
  assert.ok(v4492.includes(".product-card-cta {"));
  assert.ok(v4492.includes("min-height: 50px !important;"));
  assert.ok(v4492.includes("border-radius: 999px !important;"));
});

test("V449.2 does not modify the V449.1 bottom dock contract", () => {
  assert.equal(v4492.includes(".mobile-bottom-nav-v225"), false);
  assert.equal(v4492.includes("--mobile-nav-space"), false);
});
