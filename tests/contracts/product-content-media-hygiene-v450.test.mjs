import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const content = readFileSync(resolve(root, "src/lib/product-content.ts"), "utf8");
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const page = readFileSync(resolve(root, "src/components/ProductPageContent.tsx"), "utf8");
const route = readFileSync(resolve(root, "src/app/boutique/[slug]/page.tsx"), "utf8");
const safeImage = readFileSync(resolve(root, "src/components/SafeImage.tsx"), "utf8");

test("V450 strips high-confidence supplier shipping boilerplate", () => {
  assert.match(content, /important notice regarding international shipping/);
  assert.match(content, /dhl duty & tax calculator/);
  assert.match(content, /simplyduty/);
  assert.match(content, /raw\.slice\(0, cutAt\)/);
});

test("V450 sanitizes modal short and long descriptions", () => {
  assert.match(card, /sanitizeStorefrontProductText/);
  assert.match(card, /const shortDescription = sanitizeStorefrontProductText/);
  assert.match(card, /const fullDescription =[\s\S]*sanitizeStorefrontProductText/);
});

test("V450 sanitizes dedicated product-page copy", () => {
  assert.match(page, /sanitizeStorefrontProductText/);
  assert.match(page, /const description = sanitizeStorefrontProductText/);
  assert.match(page, /const longDescription =[\s\S]*sanitizeStorefrontProductText/);
});

test("V450 keeps supplier boilerplate out of SEO and JSON-LD", () => {
  assert.match(route, /sanitizeStorefrontProductText/);
  assert.match(route, /if \(sanitized\) return sanitized/);
});

test("V450 broken CMS media falls back to local placeholder once", () => {
  assert.match(safeImage, /fallbackImage = "\/product-placeholder\.svg"/);
  assert.match(safeImage, /dataset\.safeImageFallback === "true"/);
  assert.match(safeImage, /image\.srcset = ""/);
  assert.match(safeImage, /image\.src = fallbackImage/);
});

test("V450 preserves optimizer policy while adding recovery", () => {
  assert.match(safeImage, /hostname\.endsWith\("\.supabase\.co"\)/);
  assert.match(safeImage, /loader=\{passthroughLoader\}/);
  assert.match(safeImage, /unoptimized/);
  assert.match(safeImage, /onError=\{handleError\}/);
});
