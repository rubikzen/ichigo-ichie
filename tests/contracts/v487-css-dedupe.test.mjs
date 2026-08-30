import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const pkg = JSON.parse(src("package.json"));
const globals = src("src/app/globals.css");
const prepare = src("scripts/prepare-css-v487.mjs");
const gitignore = src(".gitignore");
const adminLayout = src("src/app/admin/layout.tsx");
const customerLayout = src("src/app/compte/layout.tsx");
const checkoutLayout = src("src/app/checkout/layout.tsx");

execFileSync(process.execPath, ["scripts/prepare-css-v487.mjs"], { cwd: root, stdio: "pipe" });
const full = src("src/app/styles/globals-04.full.generated.css");
const storefront = src("src/app/styles/globals-04.storefront.generated.css");

test("V487 generates separate storefront and compatibility styles before dev/build", () => {
  assert.equal(pkg.scripts["css:prepare"], "node scripts/prepare-css-v487.mjs");
  assert.equal(pkg.scripts.predev, "npm run css:prepare");
  assert.equal(pkg.scripts.prebuild, "npm run css:prepare");
  assert.match(globals, /globals-04\.storefront\.generated\.css/);
  assert.doesNotMatch(globals, /globals-04\.full\.generated\.css/);
  assert.match(adminLayout, /globals-04\.full\.generated\.css/);
  assert.match(customerLayout, /globals-04\.full\.generated\.css/);
  assert.match(checkoutLayout, /globals-04\.full\.generated\.css/);
  assert.match(gitignore, /globals-04\.full\.generated\.css/);
  assert.match(gitignore, /globals-04\.storefront\.generated\.css/);
});

test("V487 keeps the last exact top-level CSS occurrence so cascade semantics stay stable", () => {
  assert.match(prepare, /splitTopLevelCss/);
  assert.match(prepare, /lastOccurrence\.set\(key, index\)/);
  assert.match(prepare, /lastOccurrence\.get\(key\) !== index/);
  assert.match(prepare, /function unitKey/);
  assert.match(prepare, /unbalanced braces/);
  assert.match(prepare, /unexpected closing brace/);
});

test("V487 removes only route-anchored account, admin and checkout rules from storefront", () => {
  assert.match(full, /\.customer-order-top-v243\b/);
  assert.doesNotMatch(storefront, /\.customer-order-top-v243\b/);
  assert.match(full, /\.admin-stats-shell-v247\b/);
  assert.doesNotMatch(storefront, /\.admin-stats-shell-v247\b/);
  assert.match(full, /\.checkout-page-v481\b/);
  assert.doesNotMatch(storefront, /\.checkout-page-v481\b/);
  assert.match(prepare, /checkout:\s*\[\/\^checkout-/);
  assert.match(prepare, /ROUTE_ANCHORS/);
  assert.match(prepare, /routeForUnit/);
});

test("V487 produces a meaningful storefront CSS reduction", () => {
  const fullBytes = Buffer.byteLength(full);
  const storefrontBytes = Buffer.byteLength(storefront);
  const savedBytes = fullBytes - storefrontBytes;
  assert.ok(storefrontBytes < fullBytes, `storefront ${storefrontBytes}B must be smaller than full ${fullBytes}B`);
  assert.ok(savedBytes >= 15000, `expected at least 15000B route CSS savings, got ${savedBytes}B`);
});

test("V487 reports source, full, storefront, duplicate and route extraction metrics", () => {
  assert.match(prepare, /source=\$\{sourceBytes\}B/);
  assert.match(prepare, /full=\$\{fullBytes\}B/);
  assert.match(prepare, /storefront=\$\{storefrontBytes\}B/);
  assert.match(prepare, /routeExtracted=\$\{routeSavedBytes\}B/);
  assert.match(prepare, /checkout=\$\{extracted\.checkout\.units\}/);
  assert.match(prepare, /savedFromStorefront=\$\{totalStorefrontSavedBytes\}B/);
});
