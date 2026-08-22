import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const index = src("src/lib/matcha-guide-index.ts");
const guides = src("src/lib/matcha-guides.ts");
const hub = src("src/app/guides/page.tsx");
const article = src("src/app/guides/[slug]/page.tsx");
const articleUi = src("src/components/MatchaGuidePageContent.tsx");
const teaser = src("src/components/MatchaGuidesTeaser.tsx");
const productLinks = src("src/components/ProductGuideLinks.tsx");
const home = src("src/components/HomePageContent.tsx");
const productPage = src("src/components/ProductPageContent.tsx");
const footer = src("src/components/SiteFooter.tsx");
const sitemap = src("src/app/sitemap.ts");
const css = src("src/app/styles/globals-04.css");

test("V469 defines exactly three evergreen matcha guide destinations", () => {
  for (const slug of [
    "comment-choisir-son-matcha",
    "usucha-vs-koicha",
    "matcha-ceremonie-vs-latte",
  ]) {
    assert.match(index, new RegExp(`slug: "${slug}"`));
    assert.match(index, new RegExp(`href: "/guides/${slug}"`));
  }
  assert.equal((index.match(/slug: "/g) || []).length, 3);
});

test("V469 guide copy is substantial bilingual and avoids claiming ceremonial is an official universal grade", () => {
  assert.match(guides, /introFr/);
  assert.match(guides, /introEn/);
  assert.match(guides, /sections:/);
  assert.match(guides, /faq:/);
  assert.match(guides, /n’est pas une classification légale universelle|n’est pas un grade légal universel/);
  assert.match(guides, /not a universal legal/);
  assert.match(guides, /2 g/);
  assert.match(guides, /3,5 à 4 g/);
});

test("V469 guide hub is canonical indexable and publishes CollectionPage ItemList breadcrumbs", () => {
  assert.match(hub, /alternates: \{ canonical: "\/guides" \}/);
  assert.match(hub, /"@type": "CollectionPage"/);
  assert.match(hub, /"@type": "ItemList"/);
  assert.match(hub, /"@type": "BreadcrumbList"/);
  assert.match(hub, /MATCHA_GUIDE_SUMMARIES\.map/);
});

test("V469 article route is static canonical and has Article Breadcrumb FAQ structured data", () => {
  assert.match(article, /generateStaticParams/);
  assert.match(article, /generateMetadata/);
  assert.match(article, /alternates: \{ canonical: guide\.href \}/);
  assert.match(article, /"@type": "Article"/);
  assert.match(article, /"@type": "BreadcrumbList"/);
  assert.match(article, /"@type": "FAQPage"/);
  assert.match(article, /dangerouslySetInnerHTML/);
});

test("V469 recommendations are derived from current shop catalogue merchandising tags", () => {
  assert.match(article, /getCachedCatalog\("shop"\)/);
  assert.match(article, /productMatchaFinderTags/);
  assert.match(article, /guide\.recommendedTags/);
  assert.match(article, /\.slice\(0, 3\)/);
  assert.doesNotMatch(article, /productIds = \[/);
});

test("V469 article UI links guides to real current product pages without duplicating purchase logic", () => {
  assert.match(articleUi, /products: Product\[\]/);
  assert.match(articleUi, /\/boutique\/\$\{encodeURIComponent/);
  assert.match(articleUi, /product\.ideal_for/);
  assert.doesNotMatch(articleUi, /addItem\(|setQuantity\(|\/api\/orders/);
});

test("V469 homepage and product pages create a real internal-link topic cluster", () => {
  assert.match(home, /<MatchaGuidesTeaser \/>/);
  assert.match(teaser, /MATCHA_GUIDE_SUMMARIES/);
  assert.match(productPage, /<ProductGuideLinks product=\{product\} \/>/);
  assert.match(productLinks, /productMatchaFinderTags/);
  assert.match(productLinks, /comment-choisir-son-matcha/);
});

test("V469 guide hub is discoverable from footer and XML sitemap", () => {
  assert.match(footer, /href="\/guides"/);
  assert.match(sitemap, /\$\{base\}\/guides/);
  assert.match(sitemap, /comment-choisir-son-matcha/);
  assert.match(sitemap, /usucha-vs-koicha/);
  assert.match(sitemap, /matcha-ceremonie-vs-latte/);
});

test("V469 keeps SEO pages responsive and editorial rather than adding commerce schema", () => {
  assert.match(css, /V469 — Matcha SEO guide hub/);
  assert.match(css, /@media \(max-width: 860px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(article, /Offer|AggregateRating|Review/);
  // The editorial copy may legitimately say that origin is NOT a guarantee
  // of quality. Guard against absolute marketing claims instead of banning the
  // word "guarantee" even inside a negation.
  assert.match(
    guides,
    /n’est donc pas, à lui seul, une garantie de qualité/,
  );
  assert.match(guides, /not a guarantee of quality/);
  assert.doesNotMatch(
    guides,
    /guaranteed quality|quality guaranteed|garantie absolue|qualité garantie|garantit la qualité/i,
  );
});

test("V469 is schema-free and does not mutate checkout order or stock code", () => {
  const combined = [index, guides, hub, article, articleUi, teaser, productLinks].join("\n");
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
  assert.doesNotMatch(combined, /stock\s*[-+]=|setQuantity\(|clear\(\)/);
});
