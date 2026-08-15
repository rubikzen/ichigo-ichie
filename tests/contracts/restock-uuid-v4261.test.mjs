import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const publicRoute = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");
const adminRoute = readFileSync(resolve(root, "src/app/api/admin/restock/process/route.ts"), "utf8");

test("public restock subscription accepts canonical UUIDs without version locking", () => {
  assert.match(publicRoute, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/);
  assert.doesNotMatch(publicRoute, /\[1-5\]\[0-9a-f\]\{3\}/);
  assert.match(publicRoute, /RESTOCK_PRODUCT_INVALID/);
  assert.match(publicRoute, /\.eq\("id", productId\)/);
});

test("admin restock processor uses the same canonical UUID validation", () => {
  assert.match(adminRoute, /\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}/);
  assert.doesNotMatch(adminRoute, /\[1-5\]\[0-9a-f\]\{3\}/);
  assert.match(adminRoute, /requireAdmin\(request\)/);
  assert.match(adminRoute, /processRestockNotificationsForProduct/);
});
