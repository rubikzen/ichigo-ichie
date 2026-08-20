import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const hook = readFileSync(resolve(root, "src/components/admin/useAdminCatalog.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V454 canonical product save can be reused outside a form submit and returns saved truth", () => {
  assert.match(hook, /async function saveProduct\(\s*event\?: FormEvent,\s*\): Promise<AdminProduct \| null>/);
  assert.match(hook, /event\?\.preventDefault\(\)/);
  assert.match(hook, /return savedProduct/);
  assert.match(hook, /return createdProduct/);
});

test("V454 save failures never advance because the reusable save returns null", () => {
  assert.match(hook, /setMessage\(error\.message\);\s*return null;/);
  assert.match(hook, /setMessage\(error\?\.message \?\? "Création impossible\."\);\s*return null;/);
});

test("V454 can preserve success feedback when intentionally changing review products", () => {
  assert.match(hook, /preserveMessage = false/);
  assert.match(hook, /if \(!preserveMessage\) setMessage\(""\)/);
  assert.match(admin, /chooseProduct\(target, "shop", undefined, true\)/);
});

test("V454 derives a next-review target that can never point at the current draft", () => {
  assert.match(admin, /const reviewAdvanceProduct/);
  assert.match(admin, /nextReviewProduct\.id !== productDraft\.id/);
});

test("V454 save-and-next waits for persistence and re-audits before advancing", () => {
  assert.match(admin, /async function saveAndOpenNextReview/);
  assert.match(admin, /const savedProduct = await saveProduct\(\)/);
  assert.match(admin, /auditProductContent\(\{ \.\.\.savedProduct, kind: "shop" \}\)/);
  assert.match(admin, /if \(remainingIssues\.length > 0\) return/);
});

test("V454 keeps normal save available and enables automatic advance only for a clean draft", () => {
  assert.match(admin, /Enregistrer et suivant →/);
  assert.match(admin, /disabled=\{saving \|\| draftContentIssues\.length > 0\}/);
  assert.match(
    admin,
    /type="submit" className="button ghost" disabled=\{saving\}>\{saving \? "Enregistrement…" : "Enregistrer"\}<\/button>/,
  );
  assert.match(admin, /Enregistrer et continuer/);
});

test("V454 review save actions stay compact and mobile friendly", () => {
  assert.match(css, /Ichigo Ichie V4\.54 — Review productivity/);
  assert.match(css, /drawer-save-actions-v454/);
  assert.match(css, /@media \(max-width: 640px\)/);
});

test("V454 remains an admin workflow change with no schema commerce or translation mutation", () => {
  assert.doesNotMatch(admin, /addItem\(/);
  assert.doesNotMatch(hook, /create table/i);
  assert.doesNotMatch(hook, /alter table/i);
  assert.doesNotMatch(admin, /translate/i);
});
