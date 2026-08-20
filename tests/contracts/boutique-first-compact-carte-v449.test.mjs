import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const page = src("src/app/page.tsx");
const home = src("src/components/HomePageContent.tsx");
const catalog = src("src/components/UnifiedCatalogSections.tsx");
const menuCard = src("src/components/MenuInfoCard.tsx");
const header = src("src/components/SiteHeader.tsx");
const mobileNav = src("src/components/MobileBottomNav.tsx");
const css = src("src/app/styles/globals-04.css");

test("V449 homepage featured products now come from the Shop rather than the Menu", () => {
  assert.equal(page.includes("const featured = menu.products"), false);
  assert.equal(home.includes("featured: Product[]"), false);
  assert.ok(home.includes("<HomeFeatured products={shopFeatured} />"));
});

test("Boutique is rendered before the tasting bridge and the full Carte", () => {
  const shop = catalog.indexOf('<CatalogBlock id="boutique"');
  const bridge = catalog.indexOf('className="boutique-menu-bridge-v449"');
  const menu = catalog.lastIndexOf('<CatalogBlock id="menu"');

  assert.ok(shop >= 0);
  assert.ok(bridge > shop);
  assert.ok(menu > bridge);
});

test("V449 introduces a bilingual taste-before-you-choose bridge into the Carte", () => {
  assert.ok(catalog.includes('"DÉGUSTER SUR PLACE"'));
  assert.ok(catalog.includes('"Vous souhaitez goûter avant de choisir ?"'));
  assert.ok(catalog.includes('"TASTE IN STORE"'));
  assert.ok(catalog.includes('href="#menu"'));
});

test("all menu products remain rendered through the existing category groups", () => {
  assert.ok(catalog.includes("categoryProducts.map(renderProduct)"));
  assert.ok(catalog.includes("uncategorized.map(renderProduct)"));
  assert.ok(catalog.includes('activeCategory === "all"'));
});

test("menu products opt into compact cards without changing Shop ProductCard rendering", () => {
  assert.ok(
    catalog.includes(
      '<MenuInfoCard key={product.id} product={product} compact />'
    )
  );
  assert.ok(
    catalog.includes('<ProductCard key={product.id} product={product} />')
  );
  assert.ok(menuCard.includes("compact?: boolean;"));
  assert.ok(menuCard.includes("menu-info-card-compact-v449"));
});

test("Carte keeps category filtering but drops the unnecessary sort control", () => {
  assert.ok(catalog.includes("onepage-category-tabs"));
  assert.ok(catalog.includes('{kind === "shop" && ('));
  assert.ok(catalog.includes('className="catalog-sort-v221"'));
});

test("desktop navigation places Boutique before La carte", () => {
  const shop = header.indexOf('href="/#boutique"');
  const menu = header.indexOf('href="/#menu"');
  assert.ok(shop >= 0);
  assert.ok(menu > shop);
});

test("mobile navigation also places Boutique before Carte", () => {
  const navStart = mobileNav.indexOf(
    '<nav className="mobile-bottom-nav-v225'
  );
  const mobileBlock = mobileNav.slice(navStart);
  const shop = mobileBlock.indexOf('href="/#boutique"');
  const menu = mobileBlock.indexOf('href="/#menu"');

  assert.ok(shop >= 0);
  assert.ok(menu > shop);
});

test("compact Carte uses two-column rows on desktop and one column on smaller screens", () => {
  assert.ok(
    css.includes(
      "Ichigo Ichie V4.49 — Boutique-first homepage & compact carte"
    )
  );
  assert.ok(
    css.includes(
      ".menu-compact-grid-v449 {\n  grid-template-columns: repeat(2, minmax(0, 1fr));"
    )
  );
  assert.ok(
    css.includes(
      "@media (max-width: 900px) {\n  .boutique-menu-bridge-v449"
    )
  );
  const v449Marker = css.indexOf(
    "/* Ichigo Ichie V4.49 — Boutique-first homepage & compact carte */"
  );
  const media900 = css.indexOf("@media (max-width: 900px)", v449Marker);
  const media760 = css.indexOf("@media (max-width: 760px)", media900);
  const responsive = css.slice(media900, media760);
  assert.ok(responsive.includes(".menu-compact-grid-v449"));
  assert.ok(responsive.includes("grid-template-columns: 1fr"));
});

test("compact Carte keeps image name price badge and description while reducing footprint", () => {
  assert.ok(css.includes("grid-template-columns: 104px minmax(0, 1fr)"));
  assert.ok(css.includes(".menu-info-card-compact-v449 .menu-info-media"));
  assert.ok(css.includes(".menu-info-card-compact-v449 .menu-info-badge"));
  assert.ok(css.includes(".menu-info-card-compact-v449 .menu-info-title-row h4"));
  assert.ok(css.includes(".menu-info-card-compact-v449 .menu-info-title-row strong"));
  assert.ok(css.includes(".menu-info-card-compact-v449 .menu-info-body > p"));
  assert.ok(css.includes("-webkit-line-clamp: 2"));
});
