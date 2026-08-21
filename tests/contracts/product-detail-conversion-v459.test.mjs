import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const page = readFileSync(
  resolve(root, "src/components/ProductPageContent.tsx"),
  "utf8",
);
const card = readFileSync(
  resolve(root, "src/components/ProductCard.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8",
);

const marker = "/* Ichigo Ichie V4.59 — Product detail conversion polish */";
const start = css.indexOf(marker);
assert.ok(start >= 0, "V459 CSS marker must exist");
const v459 = css.slice(start);

test("V459 adds a dedicated conversion hook without replacing the V431/V432 product route", () => {
  assert.match(page, /product-page-v431 product-page-v432 product-page-v459/);
  assert.match(page, /data-product-page-v431/);
  assert.match(page, /data-product-page-v432/);
  assert.match(page, /data-product-page-v459/);
});

test("V459 gives mobile customers a direct accessible jump to the existing purchase engine", () => {
  assert.match(page, /product-page-mobile-buy-link-v459/);
  assert.match(page, /href="#product-purchase-v459"/);
  assert.match(page, /Choisir mon format/);
  assert.match(page, /Choose my format/);
  assert.match(page, /Acheter ce produit/);
  assert.match(page, /Buy this product/);
});

test("V459 keeps every cart variant stock and restock mutation delegated to ProductCard", () => {
  assert.match(page, /<ProductCard product=\{product\} \/>/);
  assert.doesNotMatch(page, /addItem\(/);
  assert.doesNotMatch(page, /setQuantity\(/);
  assert.doesNotMatch(page, /removeItem\(/);
  assert.match(card, /const canAdd =/);
  assert.match(card, /<RestockNotify/);
});

test("V459 mobile gallery becomes shorter without destructive packaging crop", () => {
  assert.match(v459, /@media \(max-width: 860px\)/);
  assert.match(v459, /aspect-ratio: 1 \/ 1/);
  assert.match(v459, /max-height: 390px/);
  assert.match(v459, /object-fit: contain/);
});

test("V459 compresses the mobile product story while preserving product name and description", () => {
  assert.match(v459, /font-size: clamp\(34px, 10\.8vw, 46px\)/);
  assert.match(v459, /font-size: 14px/);
  assert.match(page, /<h1>\{name\}<\/h1>/);
  assert.match(page, /\{description\}/);
});

test("V459 makes the existing purchase CTA and reassurance easier to reach and tap on mobile", () => {
  assert.match(page, /id="product-purchase-v459"/);
  assert.match(v459, /scroll-margin-top: 82px/);
  assert.match(v459, /min-height: 56px/);
  assert.match(page, /Paiement sécurisé/);
  assert.match(page, /Secure payment/);
});

test("V459 keeps origin cultivar and ideal-for facts after the purchase engine", () => {
  const purchaseIndex = page.indexOf('id="product-purchase-v459"');
  const factsIndex = page.indexOf('product-page-facts-v431 product-page-facts-v432');
  assert.ok(purchaseIndex >= 0 && factsIndex > purchaseIndex);
  assert.match(page, /product\.origin/);
  assert.match(page, /product\.cultivar/);
  assert.match(page, /product\.ideal_for/);
});

test("V459 is responsive presentation only with no schema checkout or pricing mutation", () => {
  assert.match(v459, /@media \(max-width: 430px\)/);
  assert.match(v459, /env\(safe-area-inset-bottom\)/);
  assert.doesNotMatch(page, /checkout/i);
  assert.doesNotMatch(page, /create table/i);
  assert.doesNotMatch(page, /alter table/i);
});
