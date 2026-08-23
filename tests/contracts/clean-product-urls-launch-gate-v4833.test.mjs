import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const urls = src("src/lib/product-url.ts");
const card = src("src/components/ProductCard.tsx");
const admin = src("src/components/admin/AdminCatalog.tsx");
const route = src("src/app/boutique/[slug]/page.tsx");
const sitemap = src("src/app/sitemap.ts");
const health = src("src/lib/commercial-launch.ts");

test("V483.3 recognizes historical test/copy slug segments without mutating DB data", () => {
  assert.ok(urls.includes("LEGACY_PRODUCT_SLUG_SEGMENT"));
  assert.ok(urls.includes("test|copie|copy"));
  assert.ok(urls.includes("storedProductSlugNeedsCanonical"));
  for (const forbidden of ["supabase", ".update(", ".insert(", ".delete("]) {
    assert.ok(!urls.includes(forbidden), `product-url must not contain ${forbidden}`);
  }
});

test("V483.3 derives clean ASCII public slugs from product names only for legacy stored slugs", () => {
  assert.ok(urls.includes('.normalize("NFD")'));
  assert.ok(urls.includes('.replace(/[^a-z0-9]+/g, "-")'));
  assert.ok(
    urls.includes("if (stored && !storedProductSlugNeedsCanonical(product))"),
  );
  assert.ok(urls.includes("if (nameSlug) return nameSlug"));
});

test("V483.3 storefront and admin links use the same canonical public path", () => {
  assert.ok(
    card.includes('import { productPublicPath } from "@/lib/product-url";'),
  );
  assert.equal(
    card.split("href={productPublicPath(product)}").length - 1,
    2,
  );
  assert.ok(admin.includes("productPublicPath(productDraft)"));
});

test("V483.3 product route resolves both stored alias and clean public slug", () => {
  assert.ok(route.includes("normalizedSlug(item.slug) === requestedSlug"));
  assert.ok(route.includes("productPublicSlug(item) === requestedSlug"));
  assert.ok(route.includes('getCachedCatalog("shop")'));
  assert.ok(!route.includes('.from("products")'));
});

test("V483.3 permanently redirects a historical stored slug to the clean canonical URL", () => {
  assert.ok(route.includes("permanentRedirect"));
  assert.ok(route.includes("const canonicalSlug = productPublicSlug(product)"));
  assert.ok(route.includes("requestedSlug !== canonicalSlug"));
  assert.ok(route.includes("permanentRedirect(productPath(product))"));
});

test("V483.3 static params retain stored aliases while exposing clean URLs", () => {
  assert.ok(route.includes("const storedSlugs ="));
  assert.ok(route.includes("slug: normalizedSlug(product.slug)"));
  assert.ok(route.includes("const publicSlugs ="));
  assert.ok(route.includes("slug: productPublicSlug(product)"));
  assert.ok(route.includes("new Map("));
});

test("V483.3 sitemap publishes only canonical product paths", () => {
  assert.ok(
    sitemap.includes('import { productPublicPath } from "@/lib/product-url";'),
  );
  assert.ok(
    sitemap.includes("url: `${base}${productPublicPath(product)}`"),
  );
  assert.ok(
    !sitemap.includes("product.slug.trim().toLowerCase()"),
  );
});

test("V483.3 no longer blocks a clean public product because its stored alias contains copie", () => {
  assert.ok(health.includes("const publicIdentity ="));
  assert.ok(health.includes("product.name_fr"));
  assert.ok(health.includes("product.name_en"));
  assert.ok(
    !health.includes("`${product.name_fr} ${product.slug}`"),
  );
  assert.ok(health.includes("catalog_test_copy_active"));
});

test("V483.3 blocks canonical public URL collisions", () => {
  assert.ok(health.includes("productsByPublicSlug"));
  assert.ok(health.includes("productPublicSlug(product)"));
  assert.ok(health.includes("catalog_public_slug_collision"));
  assert.ok(health.includes("URL publique en conflit"));
});

test("V483.3 legal placeholder detector keeps true placeholders without matching generic withdrawal instructions", () => {
  assert.ok(health.includes("const PLACEHOLDER_RE"));
  assert.ok(health.includes("avant la mise en ligne publique"));
  assert.ok(health.includes("complete before public launch"));
  assert.ok(
    !health.includes("(?:\\[?\\s*"),
    "legacy generic optional-bracket matcher must be gone",
  );
});

test("V483.3 accepts a support email already published in legal copy", () => {
  assert.ok(health.includes("function firstPublishedEmail"));
  assert.ok(health.includes("const publishedSupportEmail ="));
  assert.ok(health.includes("legalFields.map"));
  assert.ok(health.includes("if (!publishedSupportEmail)"));
});

test("V483.3 changes URL and launch-health semantics only, not commerce flows", () => {
  const combined = [urls, route, sitemap, health].join("\n");
  for (const forbidden of [
    "addItem(",
    "setQuantity(",
    "removeItem(",
    "createOrReuseStripeCheckout",
    "reserve_order",
    "decrement_stock",
  ]) {
    assert.ok(!combined.includes(forbidden), `must not contain ${forbidden}`);
  }
});
