import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const labels = readFileSync(resolve(root, "src/lib/product-label.ts"), "utf8");
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const cart = readFileSync(resolve(root, "src/components/CartPageClient.tsx"), "utf8");
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const calculation = readFileSync(resolve(root, "src/lib/order-calculation.ts"), "utf8");
const tracker = readFileSync(resolve(root, "src/components/OrderTracker.tsx"), "utf8");
const account = readFileSync(resolve(root, "src/components/CustomerAccount.tsx"), "utf8");
const invoice = readFileSync(resolve(root, "src/lib/invoice.ts"), "utf8");
const email = readFileSync(resolve(root, "src/lib/order-email.ts"), "utf8");

test("shared formatter treats exact packaging synonyms as duplicates without deleting meaningful variant names", () => {
  assert.match(labels, /\["bag", "pouch", "sachet"\]/);
  assert.match(labels, /\["can", "tin", "boite"\]/);
  assert.match(labels, /nameDuplicatesPackaging/);
  assert.match(labels, /const name = nameDuplicatesPackaging\(variant\) \? "" : rawName/);
  assert.match(labels, /nameDuplicatesPackaging\(variant\) && !weight \? "" : variantLabel\(variant\)/);
});

test("storefront and cart editor build one canonical product variant name", () => {
  assert.match(product, /composeProductVariantName\(name, variant, language\)/);
  assert.doesNotMatch(product, /`\$\{packagingLabel\(variant\.packaging, language\)\} · \$\{variantLabel\(variant\)\}`/);
  assert.match(cart, /composeProductVariantName\(baseName, variant, language\)/);
  assert.match(cart, /const displayName = product[\s\S]*?composeProductVariantName/);
});

test("checkout and historical cart labels collapse duplicated separator-delimited packaging", () => {
  assert.match(labels, /export function normalizeLegacyProductLabel/);
  assert.match(checkout, /normalizeLegacyProductLabel\(item\.name, language\)/);
  assert.match(cart, /normalizeLegacyProductLabel\(item\.name, language\)/);
});

test("server order names include packaging and weight from the same shared formatter", () => {
  assert.match(calculation, /select\("id,product_id,name,packaging,weight,price,stock,active,shipping_weight_g"\)/);
  assert.match(calculation, /itemName = composeProductVariantName\(itemName, chosenVariant, "fr"\)/);
  assert.doesNotMatch(calculation, /itemName \+= ` · \$\{chosenVariant\.name\}`/);
});

test("order views invoice and emails normalize historical duplicate labels consistently", () => {
  assert.match(tracker, /normalizeLegacyProductLabel\(item\.product_name, language\)/);
  assert.match(account, /composeProductVariantName\(base, item\.variant, language\)/);
  assert.match(account, /normalizeLegacyProductLabel\(item\.product_name, language\)/);
  assert.match(invoice, /description: normalizeLegacyProductLabel\(String\(item\.product_name\), "fr"\)/);
  assert.match(email, /normalizeLegacyProductLabel\(item\.product_name, "fr"\)/);
});
