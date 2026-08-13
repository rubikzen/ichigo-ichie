import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("storefront uses clear maximum quantity wording in French and English", () => {
  assert.doesNotMatch(card, /Maximum dans le panier/);
  assert.doesNotMatch(card, /Maximum in cart/);
  assert.equal((card.match(/Quantité maximale atteinte/g) ?? []).length, 2);
  assert.equal((card.match(/Maximum quantity reached/g) ?? []).length, 2);
});

test("single-stock product cards explain how much inventory is already in the cart", () => {
  assert.match(
    card,
    /showStock && !requiresChoice && hasStock && quantityInCartForStock > 0/,
  );
  assert.match(
    card,
    /Dans votre panier : \$\{quantityInCartForStock\} \/ \$\{currentStock\}/,
  );
  assert.match(
    card,
    /In your cart: \$\{quantityInCartForStock\} \/ \$\{currentStock\}/,
  );
  assert.match(card, /product-cart-stock-note/);
  assert.match(css, /\.product-card-compact \.product-cart-stock-note/);
  assert.match(css, /\.product-card-compact \.product-cart-stock-note\.is-max/);
});
