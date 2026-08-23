import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const hook = src("src/components/admin/useAdminCatalog.ts");
const catalog = src("src/components/admin/AdminCatalog.tsx");

test("V483.2 update save asks Supabase for the exact persisted product row", () => {
  const updateStart = hook.indexOf('if (productDraft.id) {');
  const insertStart = hook.indexOf('const { data, error } = await supabase', updateStart);
  assert.ok(updateStart >= 0 && insertStart > updateStart);

  const updateSource = hook.slice(updateStart, insertStart);
  assert.match(updateSource, /data: persistedRow/);
  assert.match(updateSource, /\.update\(payload\)/);
  assert.match(updateSource, /\.select\("\*"\)/);
  assert.match(updateSource, /\.single\(\)/);
});

test("V483.2 never reconstructs saved truth from the stale pre-save draft", () => {
  assert.doesNotMatch(
    hook,
    /const savedProduct = \{\s*\.\.\.productDraft,\s*\.\.\.payload\s*\}/,
  );
  assert.match(
    hook,
    /\.\.\.\(persistedRow as AdminProduct\)/,
  );
});

test("V483.2 normalizes persisted JSONB and array fields before using them as editor truth", () => {
  assert.match(hook, /ideal_for: persistedRow\.ideal_for \?\? \[\]/);
  assert.match(
    hook,
    /food_info: normalizedFoodInformation\(persistedRow\.food_info\)/,
  );
});

test("V483.2 synchronizes products baseline and current draft from the same saved object", () => {
  assert.match(
    hook,
    /product\.id === savedProduct\.id \? savedProduct : product/,
  );
  assert.match(hook, /setProductDraft\(savedProduct\)/);

  const baselineIndex = hook.indexOf("setProducts((current) =>");
  const draftIndex = hook.indexOf("setProductDraft(savedProduct)", baselineIndex);
  const refreshIndex = hook.indexOf("await loadProducts()", draftIndex);
  assert.ok(
    baselineIndex >= 0 && draftIndex > baselineIndex && refreshIndex > draftIndex,
    "exact persisted baseline and draft must be synchronized before catalogue refresh",
  );
});

test("V483.2 keeps V483.1 deterministic fingerprint and unsaved-close protection", () => {
  assert.match(catalog, /food_info: foodInfoFingerprint\(product\)/);
  assert.match(
    catalog,
    /productDraftFingerprint\(savedDraft\) !==\s*productDraftFingerprint\(productDraft\)/,
  );
  assert.match(catalog, /draftDirty &&\s*!window\.confirm\(/);
});

test("V483.2 does not change publication, stock, restock, cart, checkout or Stripe behavior", () => {
  assert.match(hook, /const restock = await processRestock\(savedProduct\.id\)/);
  assert.match(hook, /foodCommercialPreflight/);
  assert.match(hook, /productSellabilityPreflight/);

  const changedSaveStart = hook.indexOf('if (productDraft.id) {');
  const changedSaveEnd = hook.indexOf('const { data, error } = await supabase', changedSaveStart);
  const updateSource = hook.slice(changedSaveStart, changedSaveEnd);

  assert.doesNotMatch(
    updateSource,
    /addItem\(|setQuantity\(|removeItem\(|stripe|checkout|reserve_order|decrement_stock/i,
  );
});
