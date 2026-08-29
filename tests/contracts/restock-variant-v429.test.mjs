import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const modal = readFileSync(resolve(root, "src/components/ProductModal.tsx"), "utf8");
const notify = readFileSync(resolve(root, "src/components/RestockNotify.tsx"), "utf8");
const subscribe = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");
const stockHub = readFileSync(resolve(root, "src/components/admin/AdminStockHub.tsx"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const waitlist = readFileSync(resolve(root, "src/components/admin/RestockWaitlistAdmin.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("restock form carries an optional exact variant target to the public API", () => {
  assert.match(notify, /variantId\?: string/);
  assert.match(notify, /variantName\?: string/);
  assert.match(notify, /variantId: variantId \|\| undefined/);
  assert.match(notify, /variantName[\s\S]*?Alerte pour/);
  assert.match(notify, /variantName[\s\S]*?Alert for/);
});

test("sold-out packaging and formats remain selectable specifically for restock alerts", () => {
  assert.match(modal, /!option\.available \? "is-sold-out-option-v429"/);
  assert.match(modal, /item\.stock <= 0 \? "is-sold-out-option-v429"/);
  assert.match(modal, /Sélectionner pour créer une alerte/);
  assert.doesNotMatch(modal, /onClick=\{\(\) => setVariantId\(item\.id\)\} disabled=\{item\.stock <= 0\}/);
  assert.doesNotMatch(modal, /onClick=\{\(\) => selectPackaging\(option\.key\)\} disabled=\{!option\.available\}/);
});

test("modal restock recovery targets the exact selected variant while sold-out cards keep product-level recovery", () => {
  assert.match(modal, /variantId=\{variant\?\.id\}/);
  assert.match(modal, /variantName=\{variant \? productVariantLabel\(variant, language\) : undefined\}/);
  assert.match(modal, /context="modal"/);
  assert.match(product, /context="card"/);
  assert.match(product, /productId=\{product\.id\}/);
});

test("server validates and labels the exact variant before confirmation email delivery", () => {
  assert.match(subscribe, /select\("id,product_id,name,packaging,weight,active,stock"\)/);
  assert.match(subscribe, /confirmationVariantLabel = productVariantLabel\(variant, locale\)/);
  assert.match(subscribe, /const confirmationName = confirmationVariantLabel/);
  assert.match(subscribe, /productName: confirmationName/);
  assert.match(subscribe, /\.eq\("id", variantId\)[\s\S]*?\.eq\("product_id", productId\)/);
});

test("admin waitlist identifies the precise format customers are waiting for", () => {
  assert.match(stockHub, /variants=\{variants\}/);
  assert.match(stockHub, /<RestockWaitlistAdmin/);
  assert.doesNotMatch(admin, /RestockWaitlistAdmin/);
  assert.match(waitlist, /productVariantLabel\(variant, "fr"\)/);
  assert.match(waitlist, /variantNames\.get\(row\.variant_id\)/);
  assert.match(waitlist, /Tous les formats/);
  assert.doesNotMatch(waitlist, /Format spécifique/);
});

test("V429 gives selectable sold-out targets a distinct non-disabled visual state", () => {
  assert.match(css, /Ichigo Ichie V4\.29 — Variant restock targeting/);
  assert.match(css, /\.option-pills button\.is-sold-out-option-v429/);
  assert.match(css, /\.restock-target-v429/);
});
