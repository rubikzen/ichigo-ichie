import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const types = src("src/lib/types.ts");
const model = src("src/components/admin/catalog-model.ts");
const hook = src("src/components/admin/useAdminCatalog.ts");
const catalog = src("src/components/admin/AdminCatalog.tsx");
const helper = src("src/lib/commercial-launch.ts");
const productPage = src("src/components/ProductPageContent.tsx");
const api = src("src/app/api/admin/commercial-launch-health/route.ts");
const today = src("src/components/admin/AdminToday.tsx");
const launchAdmin = src("src/components/admin/CommercialLaunchAdmin.tsx");
const css = src("src/app/styles/globals-04.css");
const migration = src(
  "supabase/migrations/20260823140000_commercial_launch_gate_v483.sql",
);

test("V483 stores extensible food information in one JSONB product field", () => {
  assert.match(migration, /add column if not exists food_info jsonb not null default '\{\}'::jsonb/);
  assert.match(types, /export type FoodInformation = \{/);
  assert.match(types, /food_info\?: FoodInformation \| null/);
});

test("V483 never invents or backfills merchant food-label copy", () => {
  assert.doesNotMatch(migration, /ingredients_fr|allergens_fr|operator_fr/);
  assert.match(migration, /Existing products intentionally remain \{\}/);
});

test("V483 food preflight applies only to product food items, not accessories", () => {
  assert.match(helper, /if \(product\.type !== "product"\)/);
  assert.match(helper, /required: false/);
});

test("V483 blocks missing required French food information and origin", () => {
  for (const code of [
    "food_legal_name_missing",
    "food_ingredients_missing",
    "food_allergens_missing",
    "food_storage_missing",
    "food_operator_missing",
    "food_origin_missing",
  ]) {
    assert.match(helper, new RegExp(code));
  }
});

test("V483 accepts product net quantity or active variant weights", () => {
  assert.match(helper, /food\.net_quantity/);
  assert.match(helper, /variant\.weight/);
  assert.match(helper, /food_net_quantity_missing/);
});

test("V483 persists food info in canonical save and duplicate flows", () => {
  assert.match(model, /food_info: FoodInformation/);
  assert.match(model, /food_info: \{\}/);
  assert.match(hook, /food_info: normalizedFoodInformation\(productDraft\.food_info\)/);
  assert.match(hook, /food_info: normalizedFoodInformation\(product\.food_info\)/);
});

test("V483 publication and quick activation are gated by commercial food blockers", () => {
  assert.match(hook, /const commercial = foodCommercialPreflight/);
  assert.match(hook, /commercial\.blockers\.length > 0/);
  assert.match(catalog, /const draftCommercial =/);
  assert.match(catalog, /Boolean\(commercial\?\.blockers\.length\)/);
});

test("V483 product editor exposes merchant-verified food information fields", () => {
  assert.match(catalog, /data-product-food-editor-v483/);
  assert.match(catalog, /Dénomination légale · FR/);
  assert.match(catalog, /Ingrédients · FR/);
  assert.match(catalog, /Allergènes · FR/);
  assert.match(catalog, /Quantité nette/);
  assert.match(catalog, /Conservation · FR/);
  assert.match(catalog, /Opérateur responsable \/ adresse · FR/);
  assert.match(catalog, /V483 ne génère ni ne devine ces informations/);
});

test("V483 product page exposes food information before the editorial tail", () => {
  assert.match(productPage, /data-product-food-info-v483/);
  assert.match(productPage, /Informations avant achat/);
  assert.match(productPage, /foodInfo\.ingredients_fr/);
  assert.match(productPage, /foodInfo\.allergens_fr/);
  assert.match(productPage, /foodInfo\.operator_fr/);
  assert.ok(
    productPage.indexOf("data-product-food-info-v483") <
      productPage.indexOf("product-page-description-v431"),
  );
});

test("V483 launch health detects catalogue and legal launch risks", () => {
  assert.match(helper, /catalog_test_copy_active/);
  assert.match(helper, /catalog_suspicious_price/);
  assert.match(helper, /catalog_duplicate_description/);
  assert.match(helper, /PLACEHOLDER_RE/);
  assert.match(helper, /ichigo-ichie\\\.store/);
  assert.match(helper, /legal_mediation_missing/);
});

test("V483 launch health endpoint is admin-only and no-store", () => {
  assert.match(api, /requireAdmin\(request\)/);
  assert.match(api, /buildCommercialLaunchReport/);
  assert.match(api, /food_info/);
  assert.match(api, /Cache-Control": "no-store"/);
});

test("V483 surfaces launch readiness on Aujourd’hui with actionable destinations", () => {
  assert.match(today, /CommercialLaunchAdmin/);
  assert.match(launchAdmin, /data-commercial-launch-v483/);
  assert.match(launchAdmin, /LANCEMENT BLOQUÉ/);
  assert.match(launchAdmin, /PRÊT À VENDRE/);
  assert.match(launchAdmin, /onNavigate\(issue\.area, issue\.section\)/);
});

test("V483 stays out of order pricing payment stock and Stripe mutations", () => {
  const combined = [helper, productPage, launchAdmin, api].join("\n");
  assert.doesNotMatch(combined, /addItem\(|setQuantity\(|removeItem\(/);
  assert.doesNotMatch(combined, /createOrReuseStripeCheckout|checkout\.confirm/);
  assert.doesNotMatch(combined, /reserve_order|decrement_stock/);
  assert.match(css, /V483 — Commercial launch gate/);
});
