import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const header = source("src/components/SiteHeader.tsx");
const loading = source("src/app/panier/loading.tsx");

test("header cart link exposes immediate Next navigation feedback", () => {
  assert.match(header, /useLinkStatus/);
  assert.match(header, /const \{ pending \} = useLinkStatus\(\)/);
  assert.match(header, /Ouverture…/);
  assert.match(header, /Opening…/);
  assert.match(header, /cart-spinner-v378/);
});

test("cart click has tactile visual feedback even before route rendering", () => {
  assert.match(header, /\.cart-link-v378:active/);
  assert.match(header, /transform: scale\(0\.96\)/);
  assert.match(header, /cursor: progress/);
});

test("panier route provides an immediate loading boundary", () => {
  assert.match(loading, /export default function CartLoading/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /Chargement…/);
  assert.match(loading, /cart-loading-shimmer-v378/);
});

test("navigation feedback respects reduced motion", () => {
  assert.match(header, /prefers-reduced-motion: reduce/);
  assert.match(loading, /prefers-reduced-motion: reduce/);
});
