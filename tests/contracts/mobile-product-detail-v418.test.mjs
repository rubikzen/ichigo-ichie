import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/components/ProductModal.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("product detail remembers the exact opener and focuses the close control", () => {
  assert.match(card, /const \[opener, setOpener\] = useState<HTMLElement \| null>\(null\)/);
  assert.match(card, /const openProductDetails = \(openerElement: HTMLElement\) =>/);
  assert.match(card, /setOpener\(openerElement\)/);
  assert.match(card, /opener=\{opener\}/);
  assert.match(modal, /const closeButtonRef = useRef<HTMLButtonElement \| null>\(null\)/);
  assert.match(modal, /window\.requestAnimationFrame\(\(\) => closeButtonRef\.current\?\.focus\(\)\)/);
  assert.match(modal, /ref=\{closeButtonRef\} className="modal-close"/);
});

test("image title and choice CTA all register themselves as modal openers", () => {
  assert.match(card, /product-image-button" onClick=\{\(event\) => openProductDetails\(event\.currentTarget\)\}/);
  assert.match(card, /product-title-button-v415"[\s\S]*?onClick=\{\(event\) => openProductDetails\(event\.currentTarget\)\}/);
  assert.match(card, /onClick=\{\(event\) => \{[\s\S]*?if \(requiresChoice\) \{[\s\S]*?openProductDetails\(event\.currentTarget\)/);
});

test("closing the product detail restores focus to a still-mounted opener", () => {
  assert.match(modal, /if \(event\.key === "Escape"\) onClose\(\)/);
  assert.match(modal, /window\.requestAnimationFrame\(\(\) => \{[\s\S]*?if \(opener\?\.isConnected\) opener\.focus\(\)/);
  assert.match(modal, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(modal, /window\.removeEventListener\("keydown", onKeyDown\)/);
});

test("mobile product detail gives more first-viewport space to product information", () => {
  assert.match(css, /Ichigo Ichie V4\.18 — Mobile product detail density & focus/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?product-modal-v28\s*\{[\s\S]*?35dvh/);
  assert.match(css, /product-detail-scroll\s*\{[\s\S]*?padding:\s*18px 18px 132px !important/);
  assert.match(css, /product-detail-header h2\s*\{[\s\S]*?font-size:\s*clamp\(32px, 9vw, 42px\) !important/);
  assert.match(css, /product-facts\s*\{[\s\S]*?margin-block:\s*14px !important/);
  assert.match(css, /product-buy-panel\s*\{[\s\S]*?padding:\s*14px !important/);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?33dvh/);
});
