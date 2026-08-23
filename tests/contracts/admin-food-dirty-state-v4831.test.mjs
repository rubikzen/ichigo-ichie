import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const catalog = src("src/components/admin/AdminCatalog.tsx");
const hook = src("src/components/admin/useAdminCatalog.ts");

test("V483.1 fingerprints food info in a deterministic field order", () => {
  assert.match(catalog, /function foodInfoFingerprint\(product: AdminProduct\)/);

  const orderedFields = [
    "legal_name_fr",
    "legal_name_en",
    "ingredients_fr",
    "ingredients_en",
    "allergens_fr",
    "allergens_en",
    "net_quantity",
    "storage_fr",
    "storage_en",
    "operator_fr",
    "operator_en",
    "preparation_fr",
    "preparation_en",
  ];

  let previous = -1;
  for (const field of orderedFields) {
    const index = catalog.indexOf(`${field}: food.${field} ?? ""`);
    assert.ok(index > previous, `${field} must keep canonical fingerprint order`);
    previous = index;
  }
});

test("V483.1 no longer JSON-stringifies raw JSONB food_info ordering", () => {
  assert.match(
    catalog,
    /food_info: foodInfoFingerprint\(product\)/,
  );
  assert.doesNotMatch(
    catalog,
    /food_info: product\.food_info \?\? \{\}/,
  );
});

test("V483.1 keeps the existing saved-draft versus current-draft comparison", () => {
  assert.match(
    catalog,
    /productDraftFingerprint\(savedDraft\) !==\s*productDraftFingerprint\(productDraft\)/,
  );
  assert.match(
    catalog,
    /draftDirty &&\s*!window\.confirm\(/,
  );
});

test("V483.1 preserves canonical product save and DB reload behavior", () => {
  assert.match(hook, /food_info: normalizedFoodInformation\(productDraft\.food_info\)/);
  assert.match(hook, /await loadProducts\(\)/);
  assert.match(hook, /setProductDraft\(savedProduct\)/);
  assert.match(hook, /setMessage\(savedWithRestock/);
});

test("V483.1 food-info canonicalizer contains no commerce mutation", () => {
  const helperStart = catalog.indexOf("function foodInfoFingerprint");
  const helperEnd = catalog.indexOf(
    "function productDraftFingerprint",
    helperStart,
  );
  assert.ok(helperStart >= 0 && helperEnd > helperStart);

  const helperSource = catalog.slice(helperStart, helperEnd);

  assert.doesNotMatch(
    helperSource,
    /supabase|addItem\(|setQuantity\(|removeItem\(|checkout|stripe|update\(|insert\(|delete\(/i,
  );
});

test("V483.1 still fingerprints stock as editor state without mutating it", () => {
  const start = catalog.indexOf("function productDraftFingerprint");
  const end = catalog.indexOf("export function AdminCatalog", start);
  assert.ok(start >= 0 && end > start);

  const fingerprintSource = catalog.slice(start, end);
  assert.match(fingerprintSource, /stock: Number\(product\.stock\)/);
  assert.doesNotMatch(
    fingerprintSource,
    /supabase|\.update\(|\.insert\(|\.delete\(|addItem\(|setQuantity\(|removeItem\(/,
  );
});
