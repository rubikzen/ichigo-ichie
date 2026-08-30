import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const seo = src("src/lib/shop-collection-seo.ts");
const collection = src("src/components/ShopCollectionContent.tsx");
const collectionProducts = src("src/components/ShopCollectionProducts.tsx");
const boutique = src("src/app/boutique/page.tsx");
const category = src("src/app/boutique/categorie/[slug]/page.tsx");
const homepageCatalog = src("src/components/UnifiedCatalogSections.tsx");
const explore = src("src/components/MatchaExploreNav.tsx");
const sitemap = src("src/app/sitemap.ts");
const css = src("src/app/styles/globals-04.css");

test("V473 replaces the Boutique redirect with a real canonical indexable collection", () => {
  assert.doesNotMatch(boutique, /redirect\(/);
  assert.match(boutique, /getCachedCatalog\("shop"\)/);
  assert.match(boutique, /<ShopCollectionContent/);
  assert.match(boutique, /alternates: \{ canonical \}/);
  assert.match(boutique, /index: true, follow: true/);
});

test("V473 query states are noindex follow and canonicalized instead of becoming facet landing pages", () => {
  assert.match(boutique, /collectionQueryHasState\(params\)/);
  assert.match(boutique, /index: false, follow: true/);
  assert.match(boutique, /canonicalForShopQuery/);
  assert.doesNotMatch(collection, /useSearchParams|router\.push|history\.pushState/);
  assert.doesNotMatch(collectionProducts, /useSearchParams|router\.push|history\.pushState/);
});

test("V473 category and usage query states canonicalize to existing clean destinations", () => {
  assert.match(seo, /categoryCollectionPath\(category\)/);
  assert.match(seo, /MATCHA_INTENT_SUMMARIES\.find/);
  assert.match(seo, /return intent\.href/);
  assert.match(seo, /return "\/boutique"/);
});

test("V473 publishes static indexable category collections under a conflict-free category segment", () => {
  assert.match(category, /generateStaticParams/);
  assert.match(category, /categoryCollectionPath\(category\)/);
  assert.match(
    seo,
    /return `\/boutique\/categorie\/\$\{encodeURIComponent\(/,
  );
  assert.match(category, /if \(!category\) notFound\(\)/);
  assert.match(category, /currentCategory=\{category\}/);
  assert.match(category, /index: true, follow: true/);
});

test("V473 category collection query variants stay noindex with the clean category canonical", () => {
  assert.match(category, /collectionQueryHasState\(query\)/);
  assert.match(category, /index: false, follow: true/);
  assert.match(category, /const canonical = categoryCollectionPath\(category\)/);
});

test("V473 collection pages reuse ProductCard and batch reviews while keeping sort local-only", () => {
  assert.match(collection, /<ShopCollectionProducts products=\{products\} \/>/);
  assert.match(collectionProducts, /<ReviewSummaryProvider/);
  assert.match(
    collectionProducts,
    /<ProductCard key=\{product\.id\} product=\{product\} \/>/,
  );
  assert.match(collectionProducts, /const \[sortMode, setSortMode\] = useState/);
  assert.match(
    collectionProducts,
    /setSortMode\(event\.target\.value as SortMode\)/,
  );
  assert.doesNotMatch(
    collectionProducts,
    /addItem\(|setQuantity\(|\/api\/orders|\/api\/stripe/,
  );
});

test("V473 homepage category headings expose crawlable clean collection links", () => {
  assert.match(homepageCatalog, /categoryCollectionPath/);
  assert.match(homepageCatalog, /onepage-category-collection-link-v473/);
  assert.match(homepageCatalog, /Voir la collection →/);
});

test("V473 collection structured data stays editorial and avoids duplicate Product Offer Review schema", () => {
  assert.match(seo, /"@type": "CollectionPage"/);
  assert.match(seo, /"@type": "ItemList"/);
  assert.match(seo, /"@type": "BreadcrumbList"/);
  assert.doesNotMatch(
    seo,
    /"@type": "Product"|"@type": "Offer"|AggregateRating|"@type": "Review"/,
  );
});

test("V473 discovery and sitemap expose only clean Boutique and category collection URLs", () => {
  assert.match(explore, /href: "\/boutique"/);
  assert.match(sitemap, /url: `\$\{base\}\/boutique`/);
  assert.match(sitemap, /boutique\/categorie/);
  assert.doesNotMatch(sitemap, /\?category=|\?usage=|\?sort=/);
});

test("V473 collections are responsive and do not mutate checkout order or stock", () => {
  const combined = [
    seo,
    collection,
    collectionProducts,
    boutique,
    category,
    homepageCatalog,
    explore,
  ].join("\n");
  assert.match(css, /V473 — canonical shop collections and facet index control/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /overflow-x: auto/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
  assert.doesNotMatch(combined, /stock\s*[-+]=|clear\(\)/);
});
