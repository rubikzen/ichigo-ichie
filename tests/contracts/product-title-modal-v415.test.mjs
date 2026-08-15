import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("product title opens the same detail modal as the product image", () => {
  assert.match(
    card,
    /className="product-title-button-v415"[\s\S]*?onClick=\{\(\) => setOpen\(true\)\}/,
  );
  assert.match(
    card,
    /className="product-image-button"[\s\S]*?onClick=\{\(\) => setOpen\(true\)\}/,
  );
});

test("clickable product title is a real accessible button", () => {
  assert.match(
    card,
    /<button[\s\S]*?type="button"[\s\S]*?className="product-title-button-v415"/,
  );
  assert.match(
    card,
    /aria-label=\{language === "fr" \? `Voir les détails de \$\{name\}` : `View details for \$\{name\}`\}/,
  );
});

test("clickable product title preserves typography and exposes hover and keyboard focus", () => {
  assert.match(css, /Ichigo Ichie V4\.15 — Clickable product title/);
  assert.match(
    css,
    /\.product-card-compact \.product-title-button-v415\s*\{[\s\S]*?font:\s*inherit;[\s\S]*?cursor:\s*pointer;/,
  );
  assert.match(css, /\.product-card-compact \.product-title-button-v415:hover\s*\{[\s\S]*?text-decoration:\s*underline;/);
  assert.match(css, /\.product-card-compact \.product-title-button-v415:focus-visible\s*\{[\s\S]*?outline:/);
});
