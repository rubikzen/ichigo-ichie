import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const content = readFileSync(
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
const e2e = readFileSync(
  resolve(root, "tests/e2e/product-page-v431.spec.ts"),
  "utf8",
);

test("V432 turns the dedicated route into a native gallery plus purchase layout", () => {
  assert.match(content, /data-product-page-v432/);
  assert.match(content, /product-page-gallery-v432/);
  assert.match(content, /product-page-grid-v432/);
  assert.match(content, /product-page-side-v432/);
  assert.match(content, /product-page-buy-box-v432/);
});

test("product page gallery reuses product images with accessible manual navigation", () => {
  assert.match(content, /product\.images/);
  assert.match(content, /sort_order/);
  assert.match(content, /useState\(0\)/);
  assert.match(content, /Image précédente/);
  assert.match(content, /Previous image/);
  assert.match(content, /aria-pressed=\{imageIndex === index\}/);
});

test("V432 still delegates every cart variant stock and restock action to ProductCard", () => {
  assert.match(content, /<ProductCard product=\{product\} \/>/);
  assert.doesNotMatch(content, /addItem\(/);
  assert.doesNotMatch(content, /setQuantity\(/);
  assert.doesNotMatch(content, /RestockNotify/);
  assert.match(card, /const canAdd =/);
  assert.match(card, /<RestockNotify/);
});

test("embedded ProductCard becomes a flat purchase console without changing storefront cards", () => {
  assert.match(css, /Ichigo Ichie V4\.32 — Native product detail experience/);
  assert.match(css, /\.product-page-purchase-v432 \.product-card/);
  assert.match(
    css,
    /\.product-page-purchase-v432 \.product-card\.product-card-compact \.product-image-button/,
  );
  assert.match(css, /\.product-page-purchase-v432 \.product-title-row h3/);
  assert.match(css, /background:transparent/);
  assert.match(css, /box-shadow:none/);
});

test("product page keeps service reassurance and richer product facts around the purchase engine", () => {
  assert.match(content, /Paiement sécurisé/);
  assert.match(content, /Secure payment/);
  assert.match(content, /Retrait à Nice/);
  assert.match(content, /Delivery across metropolitan France/);
  assert.match(content, /product-page-facts-v432/);
  assert.match(content, /product-page-description-v432/);
});

test("V432 remains responsive and its existing canonical E2E now covers the native page shell", () => {
  assert.match(css, /@media \(max-width:860px\)/);
  assert.match(css, /\.product-page-side-v432/);
  assert.match(e2e, /main\[data-product-page-v432\]/);
  assert.match(e2e, /product-page-gallery-v432/);
  assert.match(e2e, /product-page-purchase-v432 \.product-image-button/);
  assert.doesNotMatch(e2e, /request\.post/);
});
