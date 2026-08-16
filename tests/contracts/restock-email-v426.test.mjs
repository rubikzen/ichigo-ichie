import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const processor = readFileSync(resolve(root, "src/lib/restock-notifications.ts"), "utf8");
const route = readFileSync(resolve(root, "src/app/api/admin/restock/process/route.ts"), "utf8");
const catalog = readFileSync(resolve(root, "src/components/admin/useAdminCatalog.ts"), "utf8");
const waitlist = readFileSync(resolve(root, "src/components/admin/RestockWaitlistAdmin.tsx"), "utf8");
const cancellation = readFileSync(resolve(root, "src/lib/order-cancellation.ts"), "utf8");
const adminOrder = readFileSync(resolve(root, "src/app/api/admin/orders/[id]/route.ts"), "utf8");
const recovery = readFileSync(resolve(root, "src/app/api/admin/commerce-recovery/route.ts"), "utf8");
const v425 = readFileSync(resolve(root, "tests/contracts/restock-waitlist-v425.test.mjs"), "utf8");

test("restock emails are bilingual, one-purpose and idempotent per subscription", () => {
  assert.match(processor, /est de retour en stock/);
  assert.match(processor, /is back in stock/);
  assert.match(processor, /uniquement parce que vous avez demandé une alerte/);
  assert.match(processor, /only because you requested a back-in-stock alert/);
  assert.match(processor, /"Idempotency-Key": `restock-\$\{input\.subscription\.id\}`/);
});

test("only active subscriptions whose exact target is currently available are eligible", () => {
  assert.match(processor, /\.eq\("status", "active"\)/);
  assert.match(processor, /function subscriptionIsAvailable/);
  assert.match(processor, /subscription\.variant_id/);
  assert.match(processor, /item\.id === subscription\.variant_id && item\.active/);
  assert.match(processor, /availableProductStock\(product, variants\) > 0/);
  assert.match(processor, /category\.kind !== "shop"/);
});

test("successful email delivery transitions the waitlist row to notified exactly once", () => {
  assert.match(processor, /status: "notified"/);
  assert.match(processor, /notified_at: notifiedAt/);
  assert.match(processor, /\.eq\("id", subscription\.id\)[\s\S]*?\.eq\("status", "active"\)/);
  assert.match(processor, /if \(sent\.skipped\)[\s\S]*?return;/);
});

test("restock processing endpoint is admin-only and product-scoped", () => {
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /UUID_RE\.test\(productId\)/);
  assert.match(route, /processRestockNotificationsForProduct\([\s\S]*?productId/);
  assert.match(route, /Cache-Control": "no-store"/);
});

test("admin product and variant stock saves trigger restock processing without coupling stock persistence to email success", () => {
  assert.match(catalog, /fetch\("\/api\/admin\/restock\/process"/);
  assert.match(catalog, /authorization: `Bearer \$\{token\}`/);
  assert.match(catalog, /Stock saving must never fail because the optional email side effect failed/);
  assert.match(catalog, /"stock" in patch \|\| \("active" in patch && patch\.active === true\)/);
  assert.match(catalog, /processRestock\(variant\.product_id\)/);
});

test("waitlist admin refreshes after automatic processing and exposes processed history", () => {
  assert.match(waitlist, /ichigo:restock-processed/);
  assert.match(waitlist, /alertes déjà envoyées/);
  assert.match(waitlist, /label: "Envoyées"/);
  assert.doesNotMatch(waitlist, /sera activé dans V426/);
  assert.match(v425, /Alertes retour en stock/);
});

test("stock returned by cancellation refund or recovery also processes pending restock alerts", () => {
  assert.match(cancellation, /processRestockNotificationsForOrder\(supabase, order\.id\)/);
  assert.match(adminOrder, /Refund restock notification error/);
  assert.match(adminOrder, /processRestockNotificationsForOrder\(supabase, id\)/);
  assert.match(recovery, /if \(stockReleased\)[\s\S]*?processRestockNotificationsForOrder\(supabase, latest\.id\)/);
});
