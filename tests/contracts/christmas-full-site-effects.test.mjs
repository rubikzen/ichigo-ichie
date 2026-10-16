import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { christmasIntensity, christmasOptions } from "../../src/lib/christmas-theme.ts";

const src = (path) => readFileSync(path, "utf8");
const defaults = src("src/lib/settings.ts");
const layout = src("src/app/layout.tsx");
const provider = src("src/components/SiteSettingsProvider.tsx");
const admin = src("src/components/admin/AdminSettings.tsx");
const chrome = src("src/components/SiteChrome.tsx");
const decor = src("src/components/SeasonalDecor.tsx");
const footer = src("src/components/SiteFooter.tsx");
const css = src("src/app/styles/christmas-full-site-v502.css");
const imports = src("src/app/globals.css");

test("three intensities have predictable defaults and independent effect switches", () => {
  assert.equal(christmasIntensity(undefined), "festive");
  assert.equal(christmasIntensity("soft"), "soft");
  assert.equal(christmasIntensity("full"), "full");
  assert.equal(christmasIntensity("something-else"), "festive");
  assert.deepEqual(christmasOptions({}), { enabled:false, intensity:"festive", snow:false, decor:false });
  assert.deepEqual(christmasOptions({ theme_christmas_enabled:"true" }), { enabled:true, intensity:"festive", snow:true, decor:true });
  assert.deepEqual(christmasOptions({ theme_christmas_enabled:"true", theme_christmas_intensity:"soft" }), { enabled:true, intensity:"soft", snow:false, decor:true });
  assert.deepEqual(christmasOptions({ theme_christmas_enabled:"true", theme_christmas_intensity:"full" }), { enabled:true, intensity:"full", snow:true, decor:true });
  assert.deepEqual(christmasOptions({ theme_christmas_enabled:"true", theme_christmas_snow_enabled:"false", theme_christmas_decor_enabled:"false" }), { enabled:true, intensity:"festive", snow:false, decor:false });
  assert.match(defaults, /theme_christmas_intensity: "festive"/);
  assert.match(defaults, /theme_christmas_snow_enabled: "true"/);
  assert.match(defaults, /theme_christmas_decor_enabled: "true"/);
});

test("Admin controls are persisted through existing site_settings and broadcast", () => {
  assert.match(admin, /set\("theme_christmas_intensity", e\.target\.value\)/);
  assert.match(admin, /toggle\("theme_christmas_snow_enabled"\)/);
  assert.match(admin, /toggle\("theme_christmas_decor_enabled"\)/);
  assert.match(admin, /Doux — couleurs et détails discrets/);
  assert.match(admin, /Festif — neige légère et sapin/);
  assert.match(admin, /Complet — neige, sapin et Père Noël/);
  assert.match(admin, /supabase\.from\("site_settings"\)\.upsert\(rows\)/);
  assert.match(admin, /broadcastSiteSettingsUpdate\(\)/);
});

test("SSR and client apply identical seasonal attributes and public SiteChrome only", () => {
  assert.match(layout, /data-christmas-intensity=/);
  assert.match(layout, /data-christmas-snow=/);
  assert.match(layout, /data-christmas-decor=/);
  assert.match(provider, /dataset\.christmasIntensity = season\.intensity/);
  assert.match(provider, /dataset\.christmasSnow = /);
  assert.match(provider, /dataset\.christmasDecor = /);
  assert.match(chrome, /if \(isStandaloneApp\)/);
  assert.match(chrome, /<SeasonalDecor \/>/);
  assert.match(footer, /seasonal-footer-ribbon-v502/);
});

test("fixed seasonal layer has no click interception, no network and controlled motion", () => {
  assert.match(decor, /aria-hidden="true"/);
  assert.match(decor, /<ChristmasTree \/>/);
  assert.match(decor, /data-seasonal-snow-v502/);
  assert.match(decor, /data-seasonal-santa-v502/);
  assert.match(decor, /intensity === "full" \? 30 : 17/);
  assert.match(css, /position: fixed;/);
  assert.match(css, /pointer-events: none !important;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important;/);
  assert.match(css, /body:has\(\.checkout-page\) \.seasonal-tree-v502/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(imports, /christmas-full-site-v502\.css/);
  assert.doesNotMatch(decor, /fetch\(|setInterval\(|Math\.random\(/);
});

test("site-wide decorations cover catalogue, product, cart, checkout and footer", () => {
  for (const scope of [".shop-collection-page-v473",".product-page-v431",".cart-page-v216",".checkout-page",".site-footer-v226"]) {
    assert.ok(css.includes(scope), scope);
  }
  assert.match(css, /seasonal-footer-ribbon-v502/);
});
