import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const admin = src("src/components/admin/AdminCatalog.tsx");
const hook = src("src/components/admin/useAdminCatalog.ts");
const content = src("src/lib/product-content.ts");
const sellability = src("src/lib/product-sellability.ts");
const css = src("src/app/styles/globals-04.css");

test("V477 turns the drawer into six explicit editing sections in task order", () => {
  const essential = admin.indexOf('id="product-editor-essential-v477"');
  const sale = admin.indexOf('id="product-editor-sale-v477"');
  const contentSection = admin.indexOf('id="product-editor-content-v477"');
  const photos = admin.indexOf('id="product-editor-photos-v477"');
  const quality = admin.indexOf('id="product-editor-quality-v477"');
  const advanced = admin.indexOf('id="product-editor-advanced-v477"');

  assert.ok(
    essential >= 0 &&
      sale > essential &&
      contentSection > sale &&
      photos > contentSection &&
      quality > photos &&
      advanced > quality,
  );

  for (const label of [
    "Essentiel",
    "Vente",
    "Contenu",
    "Photos",
    "SEO & qualité",
    "Avancé",
  ]) {
    assert.ok(admin.includes(`label: "${label}"`));
  }
});

test("V477 keeps high-frequency identity fields first and moves commerce fields into Vente", () => {
  const essential = admin.indexOf('id="product-editor-essential-v477"');
  const sale = admin.indexOf('id="product-editor-sale-v477"');
  const contentSection = admin.indexOf('id="product-editor-content-v477"');

  assert.ok(admin.indexOf("Nom FR", essential) < sale);
  assert.ok(admin.indexOf("Catégorie", essential) < sale);
  assert.ok(admin.indexOf("Mis en avant", essential) < sale);
  assert.ok(admin.indexOf("Prix de base (€)", sale) < contentSection);
  assert.ok(admin.indexOf("Poids expédition (g)", sale) < contentSection);
  assert.ok(admin.indexOf("Retrait uniquement", sale) < contentSection);
});

test("V477 keeps variants beside price stock and fulfilment instead of burying them later", () => {
  const sale = admin.indexOf('id="product-editor-sale-v477"');
  const contentSection = admin.indexOf('id="product-editor-content-v477"');
  assert.ok(admin.indexOf("Formats / variantes", sale) < contentSection);
  assert.ok(admin.indexOf("<VariantEditor", sale) < contentSection);
  assert.match(admin, /onSave=\{saveVariant\}/);
  assert.match(admin, /onDelete=\{deleteVariant\}/);
});

test("V477 surfaces existing content audit issues immediately beside relevant fields", () => {
  assert.match(admin, /function editorFieldHint/);
  for (const code of [
    "short_fr_missing",
    "short_fr_likely_en",
    "short_en_likely_fr",
    "long_fr_missing",
    "long_fr_likely_en",
    "long_en_likely_fr",
    "origin_missing",
    "ideal_for_missing",
    "ideal_for_cleanup",
  ]) {
    assert.ok(admin.includes(`"${code}"`));
    assert.ok(content.includes(`"${code}"`));
  }
  assert.match(admin, /product-editor-field-hint-v477/);
});

test("V477 deliberately keeps supplier boilerplate as one cross-description warning", () => {
  assert.match(admin, /issue\.code === "supplier_boilerplate"/);
  assert.match(
    admin,
    /Texte fournisseur \/ livraison internationale détecté/,
  );
  assert.match(content, /supplier_boilerplate/);
});

test("V477 moves diagnostics after editable fields while reusing V453 V456 and V457 truth", () => {
  const photos = admin.indexOf('id="product-editor-photos-v477"');
  const quality = admin.indexOf('id="product-editor-quality-v477"');
  assert.ok(quality > photos);
  assert.ok(admin.indexOf("publish-guard-banner-v456", quality) > quality);
  assert.ok(admin.indexOf("sellability-card-v457", quality) > quality);
  assert.ok(admin.indexOf("content-completion-card-v453", quality) > quality);
  assert.ok(admin.indexOf("content-quality-panel-v451", quality) > quality);
  assert.match(admin, /draftSellability\.checks\.map/);
  assert.match(admin, /draftCompletion\.steps\.map/);
  assert.match(sellability, /productSellabilityPreflight/);
});

test("V477 preserves the exact publication lock instead of weakening safety for editor convenience", () => {
  assert.match(
    admin,
    /disabled=\{!productDraft\.active && draftCategory\?\.kind === "shop" && \(draftContentIssues\.length > 0 \|\| draftSellabilityBlockers\.length > 0\)\}/,
  );
  assert.match(admin, /Publication verrouillée/);
  assert.match(admin, /Contenu à corriger avant publication/);
  assert.match(admin, /Configuration de vente à corriger avant publication/);
});

test("V477 keeps review previous-next and canonical save-next semantics intact", () => {
  assert.match(admin, /FILE DE RÉVISION/);
  assert.match(admin, /← Précédent/);
  assert.match(admin, /Suivant à revoir →/);
  assert.match(admin, /async function saveAndOpenNextReview/);
  assert.match(admin, /const savedProduct = await saveProduct\(\)/);
  assert.match(admin, /if \(remainingIssues\.length > 0\) return/);
  assert.match(admin, /Enregistrer et suivant →/);
  assert.match(admin, /Enregistrer et terminer ✓/);
});

test("V477 sticky save bar exposes dirty state and protects accidental close", () => {
  assert.match(admin, /function productDraftFingerprint/);
  assert.match(admin, /const draftDirty/);
  assert.match(admin, /function closeEditor/);
  assert.match(admin, /window\.confirm/);
  assert.match(admin, /Modifications non enregistrées/);
  assert.match(admin, /product-editor-savebar-v477/);
  assert.match(css, /\.product-editor-savebar-v477[\s\S]*position: sticky/);
  assert.match(css, /bottom: 0/);
});

test("V477 keeps public product recovery visible without inventing a new SEO API in the drawer", () => {
  assert.match(admin, /const publicProductHref/);
  assert.ok(admin.includes("productPublicPath(productDraft)"));
  assert.match(admin, /Voir la fiche publique ↗/);
  assert.match(admin, /Pilotage → SEO/);
  assert.doesNotMatch(admin, /fetch\("\/api\/admin\/seo-health/);
});

test("V477 preserves the canonical product save hook and gallery rather than duplicating persistence", () => {
  assert.match(hook, /async function saveProduct/);
  assert.match(hook, /auditProductContent/);
  assert.match(hook, /productSellabilityPreflight/);
  assert.match(admin, /<form onSubmit=\{saveProduct\}>/);
  assert.match(admin, /<ProductGalleryAdmin/);
  assert.match(admin, /onMainImageChange/);
  assert.doesNotMatch(admin, /\.from\("products"\)\.update/);
});

test("V477 remains responsive admin workflow only with no migration checkout or storefront commerce mutation", () => {
  assert.match(css, /V477 — product editor workflow/);
  assert.match(css, /product-editor-nav-v477/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /prefers-reduced-motion/);

  const v477Surface = [admin, css].join("\n");
  assert.doesNotMatch(v477Surface, /supabase\/migrations/);
  assert.doesNotMatch(admin, /addItem\(/);
  assert.doesNotMatch(admin, /from\("orders"\)|from\("order_items"\)/);
});
