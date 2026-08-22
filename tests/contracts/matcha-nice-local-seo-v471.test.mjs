import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const content = src("src/lib/matcha-nice-content.ts");
const page = src("src/app/matcha-nice/page.tsx");
const ui = src("src/components/MatchaNiceLocalContent.tsx");
const layout = src("src/app/layout.tsx");
const settings = src("src/lib/settings.ts");
const home = src("src/components/HomePageContent.tsx");
const footer = src("src/components/SiteFooter.tsx");
const sitemap = src("src/app/sitemap.ts");
const css = src("src/app/styles/globals-04.css");

test("V471 creates one canonical local landing instead of doorway duplicates", () => {
  assert.match(page, /alternates: \{ canonical: MATCHA_NICE_META\.canonical \}/);
  assert.match(content, /canonical: "\/matcha-nice"/);
  assert.match(content, /Matcha Nice \| Boutique de matcha japonais/);
  assert.doesNotMatch(page, /boutique-matcha-nice|matcha-japonais-nice/);
});

test("V471 reads practical store details from existing site settings rather than duplicating mutable contact data", () => {
  assert.match(page, /getPublicSiteSettings\(\)/);
  assert.match(page, /settings\.store_address/);
  assert.match(page, /settings\.opening_hours/);
  assert.match(page, /settings\.phone/);
  assert.match(page, /settings\.support_email/);
  assert.match(page, /settings\.store_maps_url/);
  assert.match(settings, /store_address:/);
  assert.match(settings, /opening_hours:/);
});

test("V471 deliberately references the existing global store entity instead of publishing duplicate LocalBusiness schema", () => {
  assert.match(layout, /"@id": `\$\{siteUrl\(\)\}\/#store`/);
  assert.match(layout, /"CafeOrCoffeeShop", "Store"/);
  assert.match(page, /about: \{ "@id": `\$\{base\}\/#store` \}/);
  assert.match(page, /mainEntity: \{ "@id": `\$\{base\}\/#store` \}/);
  assert.doesNotMatch(page, /CafeOrCoffeeShop|LocalBusiness/);
});

test("V471 adds page-specific WebPage ItemList Breadcrumb and FAQ structured data", () => {
  assert.match(page, /"@type": "WebPage"/);
  assert.match(page, /"@type": "ItemList"/);
  assert.match(page, /"@type": "BreadcrumbList"/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /dangerouslySetInnerHTML/);
});

test("V471 current shop selection reuses the live catalog ProductCard and batch review architecture", () => {
  assert.match(page, /getCachedCatalog\("shop"\)/);
  assert.match(page, /product\.type === "product"/);
  assert.match(page, /\.slice\(0, 6\)/);
  assert.match(ui, /<ReviewSummaryProvider/);
  assert.match(ui, /<ProductCard key=\{product\.id\} product=\{product\} \/>/);
  assert.doesNotMatch(ui, /addItem\(|setQuantity\(|\/api\/orders|\/api\/stripe/);
});

test("V471 menu examples come from the current menu rather than hard-coded drink names", () => {
  assert.match(page, /getCachedCatalog\("menu"\)/);
  assert.match(page, /\.filter\(searchableMatcha\)/);
  assert.match(page, /value\.includes\("matcha"\)/);
  assert.match(ui, /menuProducts\.map/);
  assert.doesNotMatch(content, /Matcha Coconut Cloud|Fuji Sky|Wakatake|Yugen/);
});

test("V471 local FAQ stays synchronized with dynamic address and opening-hours strings", () => {
  assert.match(content, /buildMatchaNiceFaq/);
  assert.match(content, /store\.address/);
  assert.match(content, /store\.openingHours/);
  assert.match(page, /const faq = buildMatchaNiceFaq\(store\)/);
  assert.match(ui, /const faq = buildMatchaNiceFaq\(store\)/);
});

test("V471 gets strong internal links from the physical-store homepage section and footer", () => {
  assert.match(home, /href="\/matcha-nice"/);
  assert.match(home, /Matcha à Nice/);
  assert.match(footer, /href="\/matcha-nice"/);
  assert.match(footer, /Matcha à Nice/);
  assert.match(ui, /href="\/guides\/comment-choisir-son-matcha"/);
  assert.match(ui, /href="\/matcha-usucha"/);
});

test("V471 adds the local landing to sitemap with stronger local commercial priority", () => {
  assert.match(sitemap, /url: `\$\{base\}\/matcha-nice`/);
  assert.match(sitemap, /priority: 0\.9/);
  assert.match(sitemap, /changeFrequency: "weekly"/);
});

test("V471 is responsive schema-free and does not mutate order checkout or stock", () => {
  const combined = [content, page, ui, home, footer].join("\n");
  assert.match(css, /V471 — local Matcha Nice landing/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
  assert.doesNotMatch(combined, /stock\s*[-+]=|clear\(\)/);
});
