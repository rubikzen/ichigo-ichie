import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V455 derives the final review item from the existing V453 queue only", () => {
  assert.match(admin, /const isFinalReviewProduct/);
  assert.match(admin, /currentReviewIndex === 0 && shopContentReviewCount === 1/);
  assert.doesNotMatch(admin, /review_finished_at/);
});

test("V455 makes the last review item explicit in the existing queue", () => {
  assert.match(admin, /Dernier produit à revoir/);
  assert.match(admin, /FILE DE RÉVISION/);
});

test("V455 finish action waits for canonical save success before doing anything else", () => {
  assert.match(admin, /async function saveAndFinishReview/);
  assert.match(admin, /const savedProduct = await saveProduct\(\)/);
  assert.match(admin, /if \(!savedProduct\) return/);
});

test("V455 re-audits persisted content and never closes an unresolved final fiche", () => {
  assert.match(admin, /saveAndFinishReview[\s\S]*auditProductContent\(\{ \.\.\.savedProduct, kind: "shop" \}\)/);
  assert.match(admin, /if \(remainingIssues\.length > 0\) return/);
});

test("V455 successful completion exits review mode and closes the drawer", () => {
  assert.match(admin, /setContentQualityOnly\(false\)/);
  assert.match(admin, /setAdvancedOpen\(false\)/);
  assert.match(admin, /Enregistrer et terminer ✓/);
});

test("V455 finish remains blocked while the final draft still has review issues", () => {
  assert.match(admin, /Enregistrer et terminer ✓/);
  assert.match(admin, /disabled=\{saving \|\| draftContentIssues\.length > 0\}/);
});

test("V455 zero-review toolbar shows a completed state instead of opening an empty filter", () => {
  assert.match(admin, /shopContentReviewCount > 0 \?/);
  assert.match(admin, /content-quality-filter-v455-ready/);
  assert.match(admin, /type="button" disabled>Contenu prêt ✓<\/button>/);
});

test("V455 keeps V454 save-next and normal save behavior intact", () => {
  assert.match(admin, /Enregistrer et suivant →/);
  assert.match(admin, /saveAndOpenNextReview/);
  assert.match(admin, /Enregistrer et continuer/);
});

test("V455 finish controls remain responsive and admin-only", () => {
  assert.match(css, /Ichigo Ichie V4\.55 — Review finish state/);
  assert.match(css, /drawer-save-actions-v455-finish/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(admin, /addItem\(/);
});
