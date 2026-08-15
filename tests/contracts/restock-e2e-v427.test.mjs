import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const e2e = readFileSync(resolve(root, "tests/e2e/restock-api.spec.ts"), "utf8");
const route = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");

test("V427 locks malformed versus canonical restock product id behavior", () => {
  assert.match(e2e, /RESTOCK_PRODUCT_INVALID/);
  assert.match(e2e, /00000000-0000-0000-0000-000000000001/);
  assert.match(e2e, /RESTOCK_PRODUCT_NOT_FOUND/);
  assert.match(e2e, /not\.toBe\("Produit invalide\."\)/);
});

test("V427 regression test remains non-mutating", () => {
  assert.match(e2e, /deliberately absent from the catalog/);
  assert.match(e2e, /bot-filled-invalid-id/);
  assert.doesNotMatch(e2e, /restock_subscriptions/);
  assert.match(route, /if \(clean\(body\.website, 200\)\)[\s\S]*?return NextResponse\.json\(\{ ok: true \}\)/);
});
