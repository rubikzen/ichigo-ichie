import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const content = readFileSync(resolve(root, "src/lib/product-content.ts"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V453 derives completion from existing audit truth rather than another persisted status", () => {
  assert.match(content, /productContentCompletion/);
  assert.match(content, /auditProductContent\(product\)/);
  assert.match(content, /ProductContentCompletionStatus = "ready" \| "fallback" \| "review"/);
  assert.doesNotMatch(content, /content_reviewed_at/);
});

test("V453 makes FR and EN completion explicit while preserving accepted fallbacks", () => {
  assert.match(content, /Texte court FR/);
  assert.match(content, /Texte court EN/);
  assert.match(content, /Fallback FR accepté si EN reste vide/);
  assert.match(content, /Fallback du texte court accepté/);
});

test("V453 keeps matcha-specific completion focused on long FR origin and ideal-for", () => {
  assert.match(content, /isMatchaProduct/);
  assert.match(content, /Fiche complète FR/);
  assert.match(content, /Origine commerciale vérifiée du matcha/);
  assert.match(content, /Usages recommandés renseignés sans doublon/);
  assert.doesNotMatch(content, /cultivar_missing/);
});

test("V453 surfaces supplier cleanup as a real completion step", () => {
  assert.match(content, /supplier_boilerplate/);
  assert.match(content, /Nettoyage fournisseur/);
});

test("V453 adds an overall Boutique completion progress without changing catalog loading", () => {
  assert.match(admin, /shopContentReadyCount/);
  assert.match(admin, /shopContentProgress/);
  assert.match(admin, /content-completion-overview-v453/);
  assert.match(admin, /useAdminCatalog\(supabase, categories\)/);
});

test("V453 exposes a compact per-product completion checklist in the existing drawer", () => {
  assert.match(admin, /draftCompletion\.steps\.map/);
  assert.match(admin, /content-completion-card-v453/);
  assert.match(admin, /Fallback accepté/);
});

test("V453 turns À revoir into a previous-next review queue without autosaving", () => {
  assert.match(admin, /shopReviewProducts/);
  assert.match(admin, /previousReviewProduct/);
  assert.match(admin, /nextReviewProduct/);
  assert.match(admin, /Suivant à revoir →/);
  assert.match(admin, /chooseProduct\(nextReviewProduct\)/);
});

test("V453 completion UI is responsive and respects reduced motion", () => {
  assert.match(css, /Ichigo Ichie V4\.53 — Product content completion/);
  assert.match(css, /content-completion-steps-v453/);
  assert.match(css, /@media \(max-width:640px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test("V453 remains admin-editorial only with no schema commerce or translation mutation", () => {
  assert.doesNotMatch(content, /create table/i);
  assert.doesNotMatch(content, /alter table/i);
  assert.doesNotMatch(content, /translate/i);
  assert.doesNotMatch(admin, /addItem\(/);
});
