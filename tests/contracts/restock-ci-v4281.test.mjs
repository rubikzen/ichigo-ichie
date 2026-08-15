import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const subscribe = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");
const unsubscribe = readFileSync(resolve(root, "src/app/api/restock/unsubscribe/route.ts"), "utf8");
const e2e = readFileSync(resolve(root, "tests/e2e/restock-api.spec.ts"), "utf8");
const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

test("subscribe rejects bots and malformed customer input before requiring Supabase", () => {
  const bodyIndex = subscribe.indexOf("const body = await readJsonBody");
  const honeypotIndex = subscribe.indexOf("if (clean(body.website, 200))");
  const invalidIndex = subscribe.indexOf("RESTOCK_PRODUCT_INVALID");
  const serviceIndex = subscribe.indexOf("const supabase = createServiceSupabase()");

  assert.ok(bodyIndex >= 0);
  assert.ok(honeypotIndex > bodyIndex);
  assert.ok(invalidIndex > honeypotIndex);
  assert.ok(serviceIndex > invalidIndex);
});

test("canonical UUID E2E distinguishes missing CI infrastructure from invalid product syntax", () => {
  assert.match(e2e, /body\.error\)\.not\.toBe\("Produit invalide\."\)/);
  assert.match(e2e, /response\.status\(\) === 503/);
  assert.match(e2e, /RESTOCK_SERVICE_UNAVAILABLE/);
  assert.match(e2e, /RESTOCK_PRODUCT_NOT_FOUND/);
});

test("unsubscribe verifies the signed link before requiring database infrastructure", () => {
  const bodyIndex = unsubscribe.indexOf("const body = await readJsonBody");
  const verifyIndex = unsubscribe.indexOf("verifyRestockManageToken(subscriptionId, token)");
  const serviceIndex = unsubscribe.indexOf("const supabase = createServiceSupabase()");

  assert.ok(bodyIndex >= 0);
  assert.ok(verifyIndex > bodyIndex);
  assert.ok(serviceIndex > verifyIndex);
  assert.match(unsubscribe, /RESTOCK_UNSUBSCRIBE_INVALID/);
});

test("CI uses only a disposable restock HMAC key and does not receive Supabase service credentials", () => {
  assert.match(
    ci,
    /RESTOCK_UNSUBSCRIBE_SECRET: ci-only-restock-management-key-not-for-production/,
  );
  assert.doesNotMatch(ci, /SUPABASE_SERVICE_ROLE_KEY:/);
  assert.doesNotMatch(ci, /SUPABASE_SECRET_KEY:/);
  assert.doesNotMatch(ci, /NEXT_PUBLIC_SUPABASE_URL:/);
});
