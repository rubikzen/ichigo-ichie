import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const explore = src("src/components/MatchaExploreNav.tsx");
const breadcrumbs = src("src/components/SeoBreadcrumbs.tsx");
const chrome = src("src/components/SiteChrome.tsx");
const header = src("src/components/SiteHeader.tsx");
const mobile = src("src/components/MobileBottomNav.tsx");
const productLinks = src("src/components/ProductGuideLinks.tsx");
const product = src("src/components/ProductPageContent.tsx");
const productRoute = src("src/app/boutique/[slug]/page.tsx");
const guideHub = src("src/components/MatchaGuidesIndexContent.tsx");
const guide = src("src/components/MatchaGuidePageContent.tsx");
const intent = src("src/components/MatchaIntentLandingContent.tsx");
const local = src("src/components/MatchaNiceLocalContent.tsx");
const css = src("src/app/styles/globals-04.css");

test("V472 mounts one shared discovery rail from public site chrome", () => {
  assert.match(chrome, /import \{ MatchaExploreNav \}/);
  assert.match(chrome, /<MatchaExploreNav \/>/);
  assert.equal((chrome.match(/<MatchaExploreNav \/>/g) || []).length, 1);
});

test("V472 discovery rail exposes Nice guides and all four intent landings", () => {
  assert.match(explore, /href: "\/matcha-nice"/);
  assert.match(explore, /href: "\/guides"/);
  assert.match(explore, /MATCHA_INTENT_SUMMARIES\.map/);
  assert.match(explore, /aria-current=\{item\.active \? "page"/);
  assert.match(explore, /data-matcha-explore-nav-v472/);
});

test("V472 limits the global discovery rail to relevant discovery and catalog routes", () => {
  assert.match(explore, /DISCOVERY_PREFIXES/);
  assert.match(explore, /"\/boutique"/);
  assert.match(explore, /"\/guides"/);
  assert.match(explore, /"\/matcha-"/);
  assert.match(explore, /if \(!shouldShow\(pathname\)\) return null/);
});

test("V472 adds a direct Guides entry to desktop navigation without duplicating the entire SEO cluster there", () => {
  assert.match(header, /href="\/guides"/);
  assert.equal((header.match(/href="\/guides"/g) || []).length, 1);
  assert.doesNotMatch(header, /href="\/matcha-usucha"/);
  assert.doesNotMatch(header, /href="\/matcha-koicha"/);
});

test("V472 preserves all five historical mobile dock destinations unchanged", () => {
  for (const href of [
    "/#boutique",
    "/#menu",
    "/#maison",
    "/compte",
    "/panier",
  ]) {
    assert.match(mobile, new RegExp(`href="${href.replace("/", "\\/")}"`));
  }
  assert.equal((mobile.match(/<Link/g) || []).length, 5);
  assert.doesNotMatch(mobile, /houseHref|href="\/matcha-nice"/);
});

test("V472 shared breadcrumb component uses ordered-list semantics and current-page state", () => {
  assert.match(breadcrumbs, /<nav/);
  assert.match(breadcrumbs, /<ol>/);
  assert.match(breadcrumbs, /<li key=/);
  assert.match(breadcrumbs, /aria-current=\{current \? "page"/);
  assert.match(breadcrumbs, /data-seo-breadcrumbs-v472/);
});

test("V472 standardizes visible breadcrumbs across product guides intent and local pages", () => {
  for (const file of [product, guideHub, guide, intent, local]) {
    assert.match(file, /<SeoBreadcrumbs/);
  }
  assert.doesNotMatch(product, /<nav\s+className="product-page-breadcrumb-v431"/);
  assert.doesNotMatch(guide, /<nav className="matcha-guide-breadcrumb-v469"/);
  assert.doesNotMatch(intent, /<nav\s+className="matcha-intent-breadcrumb-v470"/);
  assert.doesNotMatch(local, /<nav\s+className="matcha-nice-breadcrumb-v471"/);
});

test("V472 product visual breadcrumb now matches Product JSON-LD Home Boutique Product path", () => {
  assert.match(product, /label: name/);
  assert.match(product, /href: "\/#boutique"/);
  assert.doesNotMatch(product, /categoryNameFr|categoryNameEn/);
  assert.match(productRoute, /<ProductPageContent product=\{product\} \/>/);
  assert.match(productRoute, /position: 3, name: product\.name_fr/);
});

test("V472 product contextual links connect products to matching intent pages guides and Matcha Nice", () => {
  assert.match(productLinks, /MATCHA_INTENT_SUMMARIES/);
  assert.match(productLinks, /tags\.has\(item\.tag\)/);
  assert.match(productLinks, /href: "\/matcha-nice"/);
  assert.match(productLinks, /guides\/usucha-vs-koicha/);
  assert.match(productLinks, /guides\/matcha-ceremonie-vs-latte/);
});

test("V472 makes local intent and editorial clusters mutually reachable", () => {
  assert.match(guideHub, /href="\/matcha-nice"/);
  assert.match(guide, /href="\/matcha-nice"/);
  assert.match(intent, /href="\/matcha-nice"/);
  assert.match(local, /href="\/guides\/comment-choisir-son-matcha"/);
  assert.match(local, /href="\/matcha-usucha"/);
  assert.match(local, /href="\/matcha-koicha"/);
});

test("V472 navigation is mobile-scrollable responsive and does not touch commerce mutations", () => {
  const combined = [
    explore,
    breadcrumbs,
    chrome,
    header,
    mobile,
    productLinks,
    product,
    guideHub,
    guide,
    intent,
    local,
  ].join("\n");

  assert.match(css, /V472 — internal SEO navigation and breadcrumbs/);
  assert.match(css, /overflow-x: auto/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
});
