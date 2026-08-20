import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const hook = readFileSync(resolve(root, "src/components/admin/useAdminCatalog.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V456 canonical save audits normalized Boutique content before persisting a visible item", () => {
  assert.match(hook, /auditProductContent/);
  assert.match(hook, /if \(draftKind === "shop" && payload\.active\)/);
  assert.match(hook, /\.\.\.payload,\s*kind: "shop"/);
});

test("V456 save guard blocks persistence and returns null while visible content is unresolved", () => {
  assert.match(hook, /if \(publicationIssues\.length > 0\)/);
  assert.match(hook, /Publication bloquée/);
  assert.match(hook, /setSaving\(false\)/);
  assert.match(hook, /return null/);
});

test("V456 hidden incomplete Boutique products remain editable because the guard is publish-only", () => {
  assert.match(hook, /draftKind === "shop" && payload\.active/);
  assert.doesNotMatch(hook, /draftKind === "shop" && !payload\.active/);
});

test("V456 quick activation opens Details instead of publishing an incomplete Boutique item", () => {
  assert.match(admin, /function toggleQuickVisibility/);
  assert.match(admin, /!product\.active && kind === "shop" && productContentIssues\(product\)\.length > 0/);
  assert.match(admin, /chooseProduct\(product\);\s*return;/);
});

test("V456 quick visibility keeps normal hide and clean-publish behavior", () => {
  assert.match(admin, /void quickPatchProduct\(product\.id, \{ active: !product\.active \}\)/);
  assert.match(admin, /Corrigez le contenu avant de publier/);
  assert.match(admin, /Masquer le produit/);
});

test("V456 drawer explains why publication is locked and disables first activation while issues remain", () => {
  assert.match(admin, /publish-guard-banner-v456/);
  assert.match(admin, /Publication verrouillée/);
  assert.match(admin, /disabled=\{!productDraft\.active && draftCategory\?\.kind === "shop" && draftContentIssues\.length > 0\}/);
  assert.match(admin, /Contenu à corriger avant publication/);
});

test("V456 publication guard presentation is compact and responsive", () => {
  assert.match(css, /Ichigo Ichie V4\.56 — Safe publication guard/);
  assert.match(css, /publish-guard-banner-v456/);
  assert.match(css, /blocked-by-content-v456/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("V456 remains admin-content safety only with no schema or commerce mutation", () => {
  assert.doesNotMatch(hook, /create table/i);
  assert.doesNotMatch(hook, /alter table/i);
  assert.doesNotMatch(admin, /addItem\(/);
  assert.doesNotMatch(admin, /checkout/i);
});
