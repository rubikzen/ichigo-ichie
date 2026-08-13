import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const layout = readFileSync(resolve(root, "src/app/layout.tsx"), "utf8");
const home = readFileSync(resolve(root, "src/app/page.tsx"), "utf8");
const sitemap = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
const robots = readFileSync(resolve(root, "src/app/robots.ts"), "utf8");

test("root metadata targets local matcha search intent", () => {
  assert.match(layout, /Ichigo Ichie \| Matcha japonais à Nice/);
  assert.match(layout, /"matcha Nice"/);
  assert.match(layout, /"matcha japonais Nice"/);
  assert.match(layout, /"matcha latte Nice"/);
  assert.match(layout, /"Vieux Nice"/);
});

test("homepage has focused local SEO metadata", () => {
  assert.match(home, /title: "Matcha japonais à Nice"/);
  assert.match(home, /Vieux Nice/);
  assert.match(home, /openGraph:/);
});

test("structured data describes the Nice cafe store and website", () => {
  assert.match(layout, /"@type": \["CafeOrCoffeeShop", "Store"\]/);
  assert.match(layout, /servesCuisine: \["Japanese", "Matcha", "Tea"\]/);
  assert.match(layout, /addressLocality: "Nice"/);
  assert.match(layout, /addressRegion: "Provence-Alpes-Côte d’Azur"/);
  assert.match(layout, /"@type": "WebSite"/);
  assert.match(layout, /"@graph": \[storeSchema, websiteSchema\]/);
});

test("Google verification can be configured by environment", () => {
  assert.match(layout, /GOOGLE_SITE_VERIFICATION/);
  assert.match(layout, /verification: \{ google: googleVerification \}/);
});

test("robots and sitemap remain discoverable", () => {
  assert.match(robots, /allow: "\/"/);
  assert.match(robots, /sitemap:/);
  assert.match(sitemap, /url: `\$\{base\}\//);
});
