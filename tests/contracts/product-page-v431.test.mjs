import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const route = readFileSync(resolve(root, "src/app/boutique/[slug]/page.tsx"), "utf8");
const content = readFileSync(resolve(root, "src/components/ProductPageContent.tsx"), "utf8");
const card = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const sitemap = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const e2e = readFileSync(resolve(root, "tests/e2e/product-page-v431.spec.ts"), "utf8");

test("product detail route uses the same cached shop catalog as the homepage", () => {
  assert.match(route, /getCachedCatalog\("shop"\)/);
  assert.match(route, /const requestedSlug = normalizedSlug\(slug\)/);
  assert.match(route, /normalizedSlug\(item\.slug\) === requestedSlug/);
  assert.match(route, /catalog\.categories\.find/);
  assert.doesNotMatch(route, /createClient/);
  assert.doesNotMatch(route, /\.from\("products"\)/);
});

test("unknown or inactive product slugs cannot produce indexable product pages", () => {
  assert.match(route, /if \(!product\) notFound\(\)/);
  assert.match(route, /title: "Produit introuvable"/);
  assert.match(route, /robots: \{ index: false, follow: false \}/);
});

test("product pages publish canonical Open Graph and Twitter metadata", () => {
  assert.match(route, /alternates: \{ canonical: path \}/);
  assert.match(route, /openGraph:/);
  assert.match(route, /url: path/);
  assert.match(route, /twitter:/);
  assert.match(route, /summary_large_image/);
  assert.match(route, /product\.images\?\.\[0\]\?\.url/);
});

test("product JSON-LD exposes Product offers availability and breadcrumbs", () => {
  assert.match(route, /"@type": "Product"/);
  assert.match(route, /"@type": "Offer"/);
  assert.match(route, /https:\/\/schema\.org\/InStock/);
  assert.match(route, /https:\/\/schema\.org\/OutOfStock/);
  assert.match(route, /"@type": "BreadcrumbList"/);
  assert.match(route, /data-product-schema-v431/);
});

test("dedicated product page reuses ProductCard instead of duplicating purchase logic", () => {
  assert.match(content, /import \{ ProductCard \} from "@\/components\/ProductCard"/);
  assert.match(content, /<ProductCard product=\{product\} \/>/);
  assert.doesNotMatch(content, /addItem\(/);
  assert.doesNotMatch(content, /RestockNotify/);
  assert.match(content, /data-product-page-v431/);
});

test("storefront cards expose permanent product links and sitemap lists them", () => {
  assert.match(card, /className="product-permalink-v431"/);
  assert.match(card, /productPublicPath\(product\)/);
  assert.match(sitemap, /getCachedCatalog\("shop"\)/);
  assert.match(sitemap, /productPublicPath\(product\)/);
  assert.match(route, /slug: normalizedSlug\(product\.slug\)/);
  assert.match(route, /slug: productPublicSlug\(product\)/);
  assert.match(sitemap, /priority: 0\.8/);
});

test("V431 product pages have responsive UI and non-mutating browser coverage", () => {
  assert.match(css, /Ichigo Ichie V4\.31 — Dedicated product pages/);
  assert.match(css, /\.product-page-hero-v431/);
  assert.match(css, /\.product-page-purchase-v431/);
  assert.match(css, /@media\(max-width:860px\)/);
  assert.match(e2e, /#boutique a\.product-permalink-v431:visible/);
  assert.match(e2e, /toLowerCase\(\)/);
  assert.match(e2e, /link\[rel="canonical"\]/);
  assert.doesNotMatch(e2e, /request\.post/);
  assert.doesNotMatch(e2e, /request\.delete/);
});
