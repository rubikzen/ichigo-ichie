import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/components/ProductModal.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const storefront = `${card}\n${modal}`;

test("storefront uses clear maximum quantity wording in French and English", () => {
  assert.doesNotMatch(storefront, /Maximum dans le panier/);
  assert.doesNotMatch(storefront, /Maximum in cart/);
  assert.equal((storefront.match(/Quantité maximale atteinte/g) ?? []).length, 2);
  assert.equal((storefront.match(/Maximum quantity reached/g) ?? []).length, 2);
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

test("stock badges appear only when sold out or fewer than five items remain", () => {
  assert.match(card, /showStock && totalStock < 5 && <p/);
  assert.match(modal, /showStock && currentStock < 5 && <div/);
  assert.match(card, /totalStock <= 0 \? "sold" : "low"/);
  assert.match(modal, /currentStock <= 0 \? "sold" : "low"/);
  assert.doesNotMatch(card, /\$\{stock\} en stock/);
  assert.doesNotMatch(modal, /\$\{stock\} en stock/);
});

test("cart stock numbers stay hidden on the product card at five or more items", () => {
  assert.match(card, /currentStock < 5\s*\? \(language === "fr"/);
  assert.match(card, /Dans votre panier : \$\{quantityInCartForStock\}\`/);
  assert.match(card, /In your cart: \$\{quantityInCartForStock\}\`/);
});
