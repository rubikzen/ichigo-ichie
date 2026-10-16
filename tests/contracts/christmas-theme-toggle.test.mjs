import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) => readFileSync(path, "utf8");
const defaults = source("src/lib/settings.ts");
const admin = source("src/components/admin/AdminSettings.tsx");
const provider = source("src/components/SiteSettingsProvider.tsx");
const layout = source("src/app/layout.tsx");
const header = source("src/components/SiteHeader.tsx");
const css = source("src/app/styles/christmas-theme-v501.css");
const imports = source("src/app/globals.css");

test("Christmas theme defaults OFF and is a persistent admin setting", () => {
  assert.ok(defaults.includes('theme_christmas_enabled: "false"'));
  assert.ok(admin.includes('toggle("theme_christmas_enabled")'));
  assert.ok(admin.includes('settings.theme_christmas_enabled === "true"'));
  assert.ok(admin.includes('supabase.from("site_settings").upsert(rows)'));
});

test("client and SSR both apply the saved theme, without forced calendar scheduling", () => {
  assert.ok(layout.includes('data-seasonal-theme={settings.theme_christmas_enabled === "true" ? "christmas" : "default"}'));
  assert.ok(provider.includes('document.documentElement.dataset.seasonalTheme = settings.theme_christmas_enabled === "true"'));
  assert.ok(provider.includes('subscribeSiteSettingsUpdate'));
  assert.ok(header.includes('settings.theme_christmas_enabled === "true"'));
  assert.ok(header.includes('Noël chez Ichigo Ichie'));
  assert.ok(!provider.includes("December"));
});

test("Christmas styles are isolated and preserve nonseasonal theme", () => {
  assert.ok(imports.includes('@import "./styles/christmas-theme-v501.css";'));
  assert.ok(css.includes('html[data-seasonal-theme="christmas"] body:has(.site-header)'));
  assert.ok(css.includes('html[data-seasonal-theme="christmas"] .hero'));
  assert.ok(css.includes('html[data-seasonal-theme="christmas"] .site-header'));
  assert.ok(css.includes('html[data-seasonal-theme="christmas"] .product-card'));
  assert.ok(css.includes('.seasonal-theme-admin-preview-v501'));
  assert.ok(css.includes('@media (max-width: 650px)'));
  assert.equal(css.includes("animation: infinite"), false);
});

test("seasonal controls are presentation only, not checkout or pricing", () => {
  assert.ok(!header.includes("stripe.checkout.sessions"));
  assert.ok(!provider.includes("reserve_shop_order_stock"));
  assert.ok(!css.includes(".checkout-form button:disabled"));
});

test("the holiday hero pill resets all inherited circle geometry", () => {
  const badge = css.match(/html\[data-seasonal-theme="christmas"\] \.hero::before \{([\s\S]*?)\}/)?.[1];
  assert.ok(badge, "Christmas hero badge CSS should exist");
  assert.match(badge, /inset:\s*21px auto auto clamp\(/);
  assert.match(badge, /width:\s*max-content;/);
  assert.match(badge, /height:\s*auto;/);
  assert.match(badge, /max-width:\s*calc\(100% - 40px\);/);
});
