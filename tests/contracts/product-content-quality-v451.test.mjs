import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const content = readFileSync(resolve(root, "src/lib/product-content.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const hook = readFileSync(resolve(root, "src/components/admin/useAdminCatalog.ts"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V451 detects likely FR/EN field language mismatches without machine rewriting copy", () => {
  assert.match(content, /detectEditorialLanguage/);
  assert.match(content, /short_fr_likely_en/);
  assert.match(content, /short_en_likely_fr/);
  assert.match(content, /long_fr_likely_en/);
  assert.match(content, /long_en_likely_fr/);
  assert.doesNotMatch(content, /translate/i);
});

test("V451 audits supplier boilerplate using the existing V450 detector", () => {
  assert.match(content, /\.some\(hasSupplierShippingBoilerplate\)/);
  assert.match(content, /supplier_boilerplate/);
});

test("V451 treats origin and ideal-for as Boutique signals while cultivar stays optional", () => {
  assert.match(content, /origin_missing/);
  assert.match(content, /ideal_for_missing/);
  assert.doesNotMatch(content, /cultivar_missing/);
});

test("V451 asks matcha products for a richer French long description", () => {
  assert.match(content, /product\.type === "product"/);
  assert.match(content, /long_fr_missing/);
});

test("V451 normalizes editorial fields only when merchant explicitly saves", () => {
  assert.match(hook, /normalizeEditorialText/);
  assert.match(hook, /normalizeIdealFor/);
  assert.match(hook, /async function saveProduct/);
  assert.match(hook, /origin: productDraft\.origin\?\.trim\(\) \|\| null/);
});

test("V451 adds a Boutique content review filter without changing catalog loading", () => {
  assert.match(admin, /contentQualityOnly/);
  assert.match(admin, /À revoir · \$\{shopContentReviewCount\}/);
  assert.match(admin, /productContentIssues\(product\)\.length > 0/);
  assert.match(admin, /useAdminCatalog\(supabase, categories\)/);
});

test("V451 exposes quality issues in quick rows and detail drawer", () => {
  assert.match(admin, /content-quality-chip-v451/);
  assert.match(admin, /content-quality-panel-v451/);
  assert.match(admin, /draftContentIssues\.map/);
  assert.match(css, /Ichigo Ichie V4\.51 — Product content quality/);
});

test("V451 remains admin-editorial only with no schema or purchase changes", () => {
  assert.doesNotMatch(content, /from\("products"\)/);
  assert.doesNotMatch(admin, /addItem\(/);
  assert.doesNotMatch(hook, /create table/i);
  assert.doesNotMatch(hook, /alter table/i);
});
