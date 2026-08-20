import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const content = readFileSync(resolve(root, "src/lib/product-content.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V452 limits automatic cleanup to deterministic safe issue codes", () => {
  assert.match(content, /SAFE_CONTENT_FIX_CODES/);
  assert.match(content, /supplier_boilerplate/);
  assert.match(content, /ideal_for_cleanup/);
  assert.match(content, /long_en_likely_fr/);
  assert.doesNotMatch(content, /SAFE_CONTENT_FIX_CODES[\s\S]{0,180}short_fr_likely_en/);
  assert.doesNotMatch(content, /SAFE_CONTENT_FIX_CODES[\s\S]{0,180}origin_missing/);
});

test("V452 safe cleanup reuses the existing sanitizer and ideal-for normalization", () => {
  assert.match(content, /applySafeContentQualityFixes/);
  assert.match(content, /normalizeEditorialText\(product\.description_fr\)/);
  assert.match(content, /normalizeIdealFor\(product\.ideal_for\)/);
});

test("V452 can replace a French long-EN mistake with existing short EN or accepted FR fallback", () => {
  assert.match(content, /issueCodes\.has\("long_en_likely_fr"\)/);
  assert.match(content, /shortEn \|\| shortFr/);
});

test("V452 applies safe fixes to the local product draft instead of saving automatically", () => {
  assert.match(admin, /function applySafeEditorialFixes/);
  assert.match(admin, /setProductDraft\(\(current\) =>/);
  assert.match(admin, /applySafeContentQualityFixes/);
});

test("V452 offers an explicit FR fallback action for a genuinely French short-EN field", () => {
  assert.match(admin, /draftHasShortEnLanguageWarning/);
  assert.match(admin, /Utiliser le fallback FR pour EN/);
  assert.match(admin, /description_en: current\.description_fr/);
});

test("V452 explains that quick fixes are draft-only and preserves an explicit Save step", () => {
  assert.match(admin, /Le brouillon est seulement prérempli/);
  assert.match(admin, /puis cliquez sur Enregistrer/);
});

test("V452 safe-fix controls are responsive and admin-only", () => {
  assert.match(css, /Ichigo Ichie V4\.52 — Editorial safe fixes/);
  assert.match(css, /content-quality-actions-v452/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("V452 introduces no schema migration or storefront commerce mutation", () => {
  assert.doesNotMatch(content, /create table/i);
  assert.doesNotMatch(content, /alter table/i);
  assert.doesNotMatch(admin, /addItem\(/);
});
