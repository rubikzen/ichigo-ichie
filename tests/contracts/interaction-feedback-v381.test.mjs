import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const productCard = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const mobileNav = readFileSync(resolve(root, "src/components/MobileBottomNav.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("direct-add product cards acknowledge a successful add immediately", () => {
  assert.match(productCard, /!requiresChoice && justAdded/);
  assert.match(productCard, /✓ Ajouté au panier/);
  assert.match(productCard, /✓ Added to cart/);
  assert.match(productCard, /is-added-v381/);
  assert.match(productCard, /aria-live="polite"/);
});

test("direct-add success feedback takes priority before the maximum-stock label", () => {
  const addedIndex = productCard.indexOf("{!requiresChoice && justAdded");
  const maxIndex = productCard.indexOf(": !requiresChoice && stockLimitReached", addedIndex);
  assert.ok(addedIndex >= 0, "missing direct-add feedback branch");
  assert.ok(maxIndex > addedIndex, "maximum-stock branch must follow added feedback");
  assert.match(productCard, /window\.setTimeout\(\(\) => setJustAdded\(false\), 1200\)/);
});

test("mobile cart navigation uses Next link pending status with a visible spinner", () => {
  assert.match(mobileNav, /import Link, \{ useLinkStatus \} from "next\/link"/);
  assert.match(mobileNav, /const \{ pending \} = useLinkStatus\(\)/);
  assert.match(mobileNav, /mobile-cart-spinner-v381/);
  assert.match(mobileNav, /Ouverture…/);
  assert.match(mobileNav, /Opening…/);
  assert.match(mobileNav, /role="status" aria-live="polite"/);
});

test("mobile cart navigation keeps active and reduced-motion feedback", () => {
  assert.match(mobileNav, /pathname\.startsWith\("\/panier"\) \? " active" : ""/);
  assert.match(css, /\.mobile-cart-link-v381:active/);
  assert.match(css, /\.mobile-cart-link-v381:has\(\.mobile-cart-icon-v381\.is-loading\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.mobile-cart-spinner-v381/);
});
