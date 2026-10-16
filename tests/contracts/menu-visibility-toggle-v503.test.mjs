import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { settingEnabled, siteSettingDefaults } from "../../src/lib/settings.ts";
const src = (path) => readFileSync(path, "utf8");

test("Carte defaults to visible unless explicitly disabled", () => {
  assert.equal(siteSettingDefaults.menu_visible, "true");
  assert.equal(settingEnabled(undefined), true);
  assert.equal(settingEnabled("true"), true);
  assert.equal(settingEnabled("false"), false);
});

test("Admin saves an independent visibility toggle", () => {
  const admin = src("src/components/admin/AdminSettings.tsx");
  assert.match(admin, /toggle\("menu_visible"\)/);
  assert.match(admin, /checked={settings.menu_visible !== "false"}/);
  assert.match(admin, /Masquée/);
  assert.match(admin, /supabase\.from\("site_settings"\)\.upsert\(rows\)/);
});

test("Public Carte, navigation, teasers and CTA links obey one setting", () => {
  const catalog = src("src/components/UnifiedCatalogSections.tsx");
  assert.match(catalog, /menuVisible && <CatalogBlock id="menu"/);
  assert.match(catalog, /menuVisible && <section className="boutique-menu-bridge-v449"/);
  for (const p of ["src/components/SiteHeader.tsx", "src/components/SiteFooter.tsx", "src/components/MobileBottomNav.tsx"]) {
    assert.match(src(p), /menuVisible && <Link href="\/#menu"/);
  }
  const home = src("src/components/HomePageContent.tsx");
  assert.match(home, /menuVisible && <Link className="button ghost mobile-menu-cta-v260"/);
  assert.match(home, /menuVisible && t\("story_link_fr"/);
  assert.match(src("src/components/MobileBottomNav.tsx"), /mobile-nav-no-menu-v503/);
  assert.match(src("src/app/styles/menu-visibility-v503.css"), /repeat\(4, minmax\(0, 1fr\)\) !important/);
});

test("Menu deep link redirects to Boutique while server omits hidden menu catalog and metadata", () => {
  assert.match(src("src/app/menu/page.tsx"), /settingEnabled\(settings.menu_visible\) \? "\/#menu" : "\/#boutique"/);
  assert.match(src("src/app/page.tsx"), /settingEnabled\(settings.menu_visible\) \? getCachedCatalog\("menu"\)/);
  assert.match(src("src/app/layout.tsx"), /settingEnabled\(settings.menu_visible\) \? { menu: menuUrl } : {}/);
});
