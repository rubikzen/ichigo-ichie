import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const card = src("src/components/ProductCard.tsx");
const modal = src("src/components/ProductModal.tsx");

test("V492 lazy-loads product modal code instead of shipping portal code in ProductCard", () => {
  assert.match(card, /dynamic\(/);
  assert.match(card, /import\("\.\/ProductModal"\)/);
  assert.match(card, /\{ ssr: false \}/);
  assert.match(card, /open && \(\s*<ProductModal/);
  assert.doesNotMatch(card, /createPortal/);
  assert.doesNotMatch(card, /useSyncExternalStore/);
  assert.doesNotMatch(card, /document\.body\.style\.overflow/);
});

test("V492 keeps modal accessibility, keyboard navigation and cart actions in the lazy chunk", () => {
  assert.match(modal, /createPortal/);
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /event\.key === "ArrowLeft"/);
  assert.match(modal, /event\.key === "ArrowRight"/);
  assert.match(modal, /document\.body\.style\.overflow = "hidden"/);
  assert.match(modal, /<RestockNotify/);
  assert.match(modal, /onAdd/);
  assert.match(modal, /onDecreaseCartQuantity/);
  assert.match(modal, /onIncreaseCartQuantity/);
});
