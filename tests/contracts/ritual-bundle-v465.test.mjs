import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const types = src("src/lib/types.ts");
const bundle = src("src/lib/bundle.ts");
const builder = src("src/components/RitualBundleBuilder.tsx");
const cartProvider = src("src/components/CartProvider.tsx");
const cart = src("src/components/CartPageClient.tsx");
const checkout = src("src/app/checkout/page.tsx");
const calculation = src("src/lib/order-calculation.ts");
const orderRoute = src("src/app/api/orders/route.ts");
const homeCatalog = src("src/components/UnifiedCatalogSections.tsx");
const catalogGrid = src("src/components/CatalogGrid.tsx");
const css = src("src/app/styles/globals-04.css");

test("V465 models a ritual as two real cart lines with shared metadata", () => {
  assert.match(types, /bundleId\?: string \| null/);
  assert.match(types, /bundleGroupId\?: string \| null/);
  assert.match(builder, /window\.crypto\.randomUUID\(\)/);
  assert.match(builder, /RITUAL_BUNDLE_ID/);
  assert.match(builder, /bundleCartKey/);
  assert.doesNotMatch(builder, /unitPrice:\s*ritualPrice/);
});

test("V465 ritual is one product plus one accessory at five percent", () => {
  assert.match(bundle, /RITUAL_BUNDLE_RATE = 0\.05/);
  assert.match(builder, /product\.type === "product"/);
  assert.match(builder, /product\.type === "accessory"/);
  assert.match(calculation, /roles\.has\("product"\)/);
  assert.match(calculation, /roles\.has\("accessory"\)/);
});

test("V465 server recalculates stock prices and discount from live catalog truth", () => {
  assert.match(calculation, /\.from\("products"\)/);
  assert.match(calculation, /chosenVariant\.price/);
  assert.match(calculation, /chosenVariant\.stock < quantity/);
  assert.match(calculation, /resolveRitualBundleDiscount\(normalized\)/);
  assert.match(calculation, /row\.line_total/);
  assert.doesNotMatch(calculation, /item\.unitPrice|item\.discount/i);
});

test("V465 refuses malformed ritual metadata and promo stacking", () => {
  assert.match(calculation, /Coffret rituel invalide/);
  assert.match(calculation, /exactement deux articles/);
  assert.match(calculation, /quantités du coffret rituel doivent rester liées/);
  assert.match(orderRoute, /bundleDiscountAmount > 0 && requestedPromoCode/);
  assert.match(orderRoute, /ne peut pas être cumulé avec un code promo/);
});

test("V465 cart keeps ritual quantity and removal linked", () => {
  assert.match(cartProvider, /item\.bundleGroupId === target\.bundleGroupId/);
  assert.match(cartProvider, /item\.bundleGroupId !== target\.bundleGroupId/);
  assert.match(cart, /candidate\.bundleGroupId === item\.bundleGroupId/);
  assert.match(cart, /Supprimer le rituel/);
});

test("V465 cart and checkout show saving and carry bundle metadata", () => {
  assert.match(cart, /cartBundleDiscount\(items\)/);
  assert.match(cart, /Avantage rituel/);
  assert.match(checkout, /bundleDiscountAmount = cartBundleDiscount\(items\)/);
  assert.match(checkout, /Matcha \+ accessoire · −5 %/);
  assert.match(checkout, /bundleId: item\.bundleId/);
  assert.match(checkout, /bundleGroupId: item\.bundleGroupId/);
});

test("V465 builder is visible in both Boutique catalogue surfaces only", () => {
  assert.match(homeCatalog, /kind === "shop"/);
  assert.match(homeCatalog, /<RitualBundleBuilder products=\{products\}/);
  assert.match(catalogGrid, /kind === "shop"/);
  assert.match(catalogGrid, /<RitualBundleBuilder products=\{products\}/);
  assert.doesNotMatch(homeCatalog, /kind === "menu" && <RitualBundleBuilder/);
});

test("V465 stays schema-free and responsive", () => {
  assert.match(css, /V465 — ritual bundle/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(orderRoute, /\.from\("bundles"\)|bundle_id:/);
  assert.doesNotMatch(calculation, /\.from\("bundles"\)/);
});
