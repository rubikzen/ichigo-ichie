import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const index = src("src/lib/matcha-intent-index.ts");
const pages = src("src/lib/matcha-intent-pages.ts");
const server = src("src/components/MatchaIntentPageServer.tsx");
const ui = src("src/components/MatchaIntentLandingContent.tsx");
const guideHub = src("src/components/MatchaGuidesIndexContent.tsx");
const sitemap = src("src/app/sitemap.ts");
const css = src("src/app/styles/globals-04.css");

const routeFiles = [
  "src/app/matcha-usucha/page.tsx",
  "src/app/matcha-koicha/page.tsx",
  "src/app/matcha-latte/page.tsx",
  "src/app/matcha-ceremonie/page.tsx",
].map(src);

test("V470 defines exactly four high-intent matcha landing destinations", () => {
  for (const href of [
    "/matcha-usucha",
    "/matcha-koicha",
    "/matcha-latte",
    "/matcha-ceremonie",
  ]) {
    assert.match(index, new RegExp(`href: "${href}"`));
  }
  assert.equal((index.match(/href: "\/matcha-/g) || []).length, 4);
});

test("V470 explicit routes map one-to-one to existing merchandising tags", () => {
  assert.match(routeFiles[0], /tag="usucha"/);
  assert.match(routeFiles[1], /tag="koicha"/);
  assert.match(routeFiles[2], /tag="latte"/);
  assert.match(routeFiles[3], /tag="ceremonial"/);
  for (const route of routeFiles) {
    assert.match(route, /getMatchaIntentMetadata/);
    assert.match(route, /revalidate = 30/);
  }
});

test("V470 product selection comes only from current shop catalogue and canonical V462 finder tags", () => {
  assert.match(server, /getCachedCatalog\("shop"\)/);
  assert.match(server, /productMatchesFinderTag\(product, tag\)/);
  assert.doesNotMatch(server, /productIds\s*=\s*\[/);
  assert.doesNotMatch(pages, /productId|variantId/);
});

test("V470 reuses ProductCard commerce and one batch review provider instead of duplicating purchase logic", () => {
  assert.match(ui, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.match(ui, /<ReviewSummaryProvider/);
  assert.match(ui, /productIds=\{products\.map/);
  assert.doesNotMatch(ui, /addItem\(|setQuantity\(|\/api\/orders|\/api\/stripe/);
});

test("V470 metadata stays canonical and intent-specific for every landing", () => {
  assert.match(pages, /alternates: \{ canonical: page\.href \}/);
  assert.match(pages, /metaTitleFr/);
  assert.match(pages, /metaDescriptionFr/);
  assert.match(pages, /openGraph/);
  assert.match(pages, /twitter/);
});

test("V470 publishes editorial collection structured data without duplicating Product Offer or Review schema", () => {
  assert.match(server, /"@type": "CollectionPage"/);
  assert.match(server, /"@type": "ItemList"/);
  assert.match(server, /"@type": "BreadcrumbList"/);
  assert.match(server, /"@type": "FAQPage"/);
  assert.doesNotMatch(server, /"@type": "Product"|"@type": "Offer"|AggregateRating|Review/);
});

test("V470 ceremonial landing explicitly avoids presenting ceremonial as a universal official grade", () => {
  assert.match(
    pages,
    /Ce n’est toutefois pas un grade légal universel/,
  );
  assert.match(
    pages,
    /not, however, a universal legal grade/,
  );
  assert.match(
    pages,
    /pas comme promesse absolue de qualité/,
  );
});

test("V470 turns the V469 guide hub into an internal choice-by-use cluster", () => {
  assert.match(guideHub, /MATCHA_INTENT_SUMMARIES/);
  assert.match(guideHub, /matcha-guide-intent-links-v470/);
  assert.match(guideHub, /intent\.href/);
  assert.match(guideHub, /intent\.labelFr/);
  assert.match(ui, /page\.guideHref/);
  assert.match(ui, /relatedPages\.map/);
});

test("V470 sitemap derives all transactional landing URLs from the shared intent index", () => {
  assert.match(sitemap, /MATCHA_INTENT_SUMMARIES/);
  assert.match(sitemap, /const intentPages/);
  assert.match(sitemap, /url: `\$\{base\}\$\{page\.href\}`/);
  assert.match(sitemap, /priority: 0\.85/);
});

test("V470 is responsive schema-free and does not mutate stock orders or checkout", () => {
  const combined = [index, pages, server, ui, guideHub].join("\n");
  assert.match(css, /V470 — high-intent matcha SEO landings/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
  assert.doesNotMatch(combined, /stock\s*[-+]=|clear\(\)/);
});
