import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const settings = src("src/lib/settings.ts");
const builder = src("src/components/RitualBundleBuilder.tsx");
const admin = src("src/components/admin/AdminSettings.tsx");
const css = src("src/app/styles/globals-04.css");

test("V465.1 makes ritual visibility a normal public site setting", () => {
  assert.match(settings, /shop_ritual_bundle_visible: "true"/);
  assert.match(builder, /settings\.shop_ritual_bundle_visible/);
  assert.match(builder, /settingEnabled/);
});

test("V465.1 exposes the ritual toggle inside existing Boutique settings", () => {
  assert.match(admin, /panel\("shop",\s*"Boutique"/);
  assert.match(admin, /toggle\("shop_ritual_bundle_visible"\)/);
  assert.match(admin, /Afficher Composez votre rituel/);
  assert.doesNotMatch(admin, /bundle_settings|new table|migration/i);
});

test("V465.1 compacts ritual copy without changing the five-percent offer", () => {
  assert.match(builder, /Matcha \+ accessoire · −5 %/);
  assert.match(builder, /Matcha \+ accessory · 5% off/);
  assert.match(builder, /Stock et disponibilité restent vérifiés au paiement/);
  assert.match(builder, /RITUAL_BUNDLE_RATE/);
});

test("V465.1 reduces visual height and keeps responsive behavior", () => {
  assert.match(css, /V465\.1 — compact ritual polish/);
  assert.match(css, /padding: 20px 24px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
