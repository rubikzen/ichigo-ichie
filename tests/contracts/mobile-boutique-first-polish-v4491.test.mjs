import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const home = readFileSync(
  resolve(root, "src/components/HomePageContent.tsx"),
  "utf8"
);
const css = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8"
);

test("V449.1 removes the duplicate three-product mobile matcha teaser", () => {
  assert.equal(home.includes('className="mobile-shop-featured-v260"'), false);
  assert.equal(home.includes('className="mobile-featured-scroll-v260"'), false);
  assert.equal(home.includes("Nos matchas à découvrir"), false);
  assert.equal(home.includes("Matchas to discover"), false);
});

test("V449.1 removes the duplicate mobile green Boutique CTA block", () => {
  assert.equal(home.includes('className="mobile-shop-cta-v260"'), false);
  assert.equal(home.includes("Trouvez le matcha qui vous ressemble."), false);
  assert.equal(home.includes("Find the matcha that suits you."), false);
});

test("mobile editorial content is moved after the full Boutique and Carte catalog", () => {
  const catalog = home.indexOf("<UnifiedCatalogSections");
  const afterCatalog = home.indexOf("mobile-home-after-catalog-v4491");

  assert.ok(catalog >= 0);
  assert.ok(afterCatalog > catalog);
  assert.ok(home.includes('className="mobile-matcha-intro-v260"'));
  assert.ok(home.includes('className="mobile-trust-v260"'));
});

test("desktop featured Shop selection remains intact while mobile hides it", () => {
  assert.ok(home.includes("<HomeFeatured products={shopFeatured} />"));
  assert.ok(css.includes(".home-featured-v218 {\n    display: none !important;"));
});

test("V449.1 shortens the mobile hero media without touching desktop hero rules", () => {
  assert.ok(
    css.includes(
      ".hero-mobile-v260 .hero-visual-v224 {\n    height: min(58dvh, 500px) !important;"
    )
  );
  assert.ok(css.includes("object-fit: cover !important;"));
});

test("mobile Boutique filters and sort are compacted but preserved", () => {
  assert.ok(css.includes(".onepage-catalog-shop .onepage-category-tabs button"));
  assert.ok(css.includes(".onepage-catalog-shop .catalog-sort-v221 select"));
  assert.ok(css.includes("min-height: 38px !important;"));
  assert.ok(css.includes("min-height: 40px !important;"));
});

test("mobile bottom navigation keeps five destinations while reducing visual height", () => {
  assert.ok(css.includes("--mobile-nav-space: 94px"));
  assert.ok(css.includes(".mobile-bottom-nav-v225.mobile-bottom-nav-v236"));
  assert.ok(css.includes("height: 72px !important;"));
  assert.ok(css.includes("min-height: 56px !important;"));
});

test("V449.1 keeps the full Boutique and Carte data flow", () => {
  assert.ok(home.includes("shopProducts={shopProducts}"));
  assert.ok(home.includes("menuProducts={menuProducts}"));
});
