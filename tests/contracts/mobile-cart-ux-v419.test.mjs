import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const cart = readFileSync(resolve(root, "src/components/CartPageClient.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("mobile cart exposes subtotal and checkout without requiring a long scroll", () => {
  assert.match(cart, /mobile-cart-checkout-bar-v419/);
  assert.match(cart, /mobile-cart-total-v419[\s\S]*?Sous-total[\s\S]*?Subtotal/);
  assert.match(cart, /mobile-cart-checkout-v419[\s\S]*?href="\/checkout"/);
  assert.match(cart, /"Commander"[\s\S]*?"Checkout"/);
});

test("mobile checkout shortcut preserves the existing aggregate stock guard", () => {
  assert.match(
    cart,
    /mobile-cart-checkout-v419[\s\S]*?aria-disabled=\{hasStockConflict\}[\s\S]*?if \(hasStockConflict\) event\.preventDefault\(\)/,
  );
  assert.match(cart, /"Corriger les quantités"[\s\S]*?"Fix quantities"/);
  assert.match(cart, /mobile-cart-checkout-bar-v419 \$\{hasStockConflict \? "has-conflict" : ""\}/);
});

test("mobile checkout bar sits above the existing bottom navigation reservation", () => {
  assert.match(css, /Ichigo Ichie V4\.19 — Mobile cart checkout reachability/);
  assert.match(
    css,
    /mobile-cart-checkout-bar-v419\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?var\(--mobile-nav-space, 118px\)[\s\S]*?env\(safe-area-inset-bottom, 0px\)/,
  );
  assert.match(css, /grid-template-columns:\s*auto minmax\(150px, 1fr\)/);
  assert.match(css, /mobile-cart-checkout-v419\s*\{[\s\S]*?min-height:\s*50px !important/);
});

test("cart quantity and line actions meet comfortable mobile touch targets", () => {
  assert.match(css, /\.qty-v216\s*\{[\s\S]*?height:\s*44px !important/);
  assert.match(
    css,
    /\.qty-v216 button\s*\{[\s\S]*?width:\s*44px !important;[\s\S]*?height:\s*44px !important;[\s\S]*?touch-action:\s*manipulation/,
  );
  assert.match(
    css,
    /\.cart-line-actions-v216 button\s*\{[\s\S]*?min-height:\s*44px !important;[\s\S]*?touch-action:\s*manipulation/,
  );
  assert.match(css, /\.cart-clear-v216\s*\{[\s\S]*?min-height:\s*44px !important/);
});
