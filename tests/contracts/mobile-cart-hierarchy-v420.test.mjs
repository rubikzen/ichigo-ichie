import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const cart = readFileSync(resolve(root, "src/components/CartPageClient.tsx"), "utf8");
const v419 = readFileSync(resolve(root, "tests/contracts/mobile-cart-ux-v419.test.mjs"), "utf8");

test("V420 keeps the V419 fixed checkout bar as the mobile primary action", () => {
  assert.match(css, /Ichigo Ichie V4\.19 — Mobile cart checkout reachability/);
  assert.match(cart, /mobile-cart-checkout-bar-v419/);
  assert.match(cart, /mobile-cart-checkout-v419/);
  assert.match(v419, /mobile cart exposes subtotal and checkout without requiring a long scroll/);
});

test("mobile summary hides only the redundant legacy checkout action and note", () => {
  assert.match(css, /Ichigo Ichie V4\.20 — Mobile cart checkout hierarchy/);
  assert.match(
    css,
    /@media \(max-width: 820px\)[\s\S]*?\.cart-summary-v216 > \.cart-checkout-v216,[\s\S]*?\.cart-summary-v216 > \.cart-summary-note-v216\s*\{[\s\S]*?display:\s*none !important;/,
  );
  assert.match(cart, /className=\{`button primary full cart-checkout-v216/);
  assert.match(cart, /className="cart-summary-note-v216"/);
});

test("mobile cart has enough bottom scroll clearance above checkout bar and dock", () => {
  assert.match(
    css,
    /Ichigo Ichie V4\.20 — Mobile cart checkout hierarchy[\s\S]*?\.cart-page-v216\s*\{[\s\S]*?230px[\s\S]*?env\(safe-area-inset-bottom, 0px\)[\s\S]*?!important;/,
  );
  assert.match(css, /\.cart-summary-v216\s*\{[\s\S]*?padding-bottom:\s*18px !important;/);
  assert.match(css, /\.cart-fulfilment-v216\s*\{[\s\S]*?margin-bottom:\s*0 !important;/);
});

test("desktop keeps the original summary checkout markup intact", () => {
  assert.match(cart, /cart-summary-v216[\s\S]*?cart-checkout-v216[\s\S]*?cart-summary-note-v216/);
  assert.doesNotMatch(
    css,
    /\/\* Ichigo Ichie V4\.20 — Mobile cart checkout hierarchy \*\/\s*\.cart-summary-v216/,
  );
});
