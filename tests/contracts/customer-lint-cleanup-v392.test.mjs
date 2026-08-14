import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const media = readFileSync(resolve(root, "src/components/SiteMediaField.tsx"), "utf8");
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const eslint = readFileSync(resolve(root, "eslint.config.mjs"), "utf8");

test("ProductCard detects hydration without setState in a mount effect", () => {
  assert.match(product, /useSyncExternalStore/);
  assert.match(product, /const mounted = useSyncExternalStore/);
  assert.doesNotMatch(product, /useEffect\(\(\) => setMounted\(true\)/);
});

test("media upload input id uses React useId instead of render-time randomness", () => {
  assert.match(media, /useId/);
  assert.match(media, /const reactId = useId\(\)/);
  assert.doesNotMatch(media, /media-upload-\$\{Math\.random/);
});

test("checkout address listbox options expose aria-selected", () => {
  assert.match(checkout, /role="option" aria-selected=\{false\}/);
});

test("React purity is blocking again in CI", () => {
  assert.match(eslint, /"react-hooks\/purity": "error"/);
  assert.match(eslint, /"react-hooks\/set-state-in-effect": "warn"/);
});
