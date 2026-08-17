import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(
  resolve(root, "src/components/admin/AdminOrders.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8",
);

test("V439 reuses V438 operational truth instead of creating another priority model", () => {
  assert.match(admin, /function orderOperationalRank\(order: OrderRow\)/);
  assert.match(admin, /const priority = orderPriorityMeta\(order\);/);
  assert.doesNotMatch(admin, /queue_status/);
  assert.doesNotMatch(admin, /operational_priority:/);
});

test("alerts sort before ready preparing pending waiting and done work", () => {
  assert.match(admin, /priority\.tone === "alert"\) return 0/);
  assert.match(
    admin,
    /orderReadyForProduction\(order\) && order\.status === "ready"\) return 1/
  );
  assert.match(
    admin,
    /orderReadyForProduction\(order\) && order\.status === "preparing"\) return 2/
  );
  assert.match(
    admin,
    /orderReadyForProduction\(order\) && order\.status === "pending"\) return 3/
  );
  assert.match(admin, /priority\.tone === "waiting"\) return 4/);
  assert.match(admin, /priority\.tone === "done"\) return 5/);
});

test("orders with equal operational priority use FIFO so older work cannot be buried", () => {
  assert.match(admin, /function compareOperationalOrders\(a: OrderRow, b: OrderRow\)/);
  assert.match(admin, /Date\.parse\(a\.created_at\)/);
  assert.match(admin, /Date\.parse\(b\.created_at\)/);
  assert.match(admin, /return safeACreatedAt - safeBCreatedAt/);
  assert.match(admin, /a\.order_number\.localeCompare\(b\.order_number, "fr"\)/);
});

test("smart sorting copies filtered results and never mutates loaded Supabase order state", () => {
  assert.match(
    admin,
    /\?\s*\[\.\.\.filteredOrders\]\.sort\(compareOperationalOrders\)\s*:\s*filteredOrders/
  );
  assert.doesNotMatch(admin, /orders\.sort\(/);
  assert.doesNotMatch(admin, /filteredOrders\.sort\(/);
});

test("active all payment and production filters use the operational queue", () => {
  assert.match(admin, /const smartQueueEnabled = \[/);
  for (const filter of ["active", "all", "payment", "pending", "preparing", "ready"]) {
    assert.ok(
      admin.includes(`"${filter}"`),
      `missing smart queue filter ${filter}`
    );
  }
});

test("historical-only filters retain existing database order because they are outside smart queue filters", () => {
  const queueBlock = admin.slice(
    admin.indexOf("const smartQueueEnabled = ["),
    admin.indexOf("].includes(orderFilter);") + "].includes(orderFilter);".length
  );
  assert.doesNotMatch(queueBlock, /"completed"/);
  assert.doesNotMatch(queueBlock, /"cancelled"/);
  assert.doesNotMatch(queueBlock, /"refunded"/);
});

test("search environment and status filtering still happen before smart queue sorting", () => {
  const filterIndex = admin.indexOf("const filteredOrders = orders.filter");
  const queueIndex = admin.indexOf("const visibleOrders = smartQueueEnabled");
  assert.ok(filterIndex >= 0, "filteredOrders baseline missing");
  assert.ok(queueIndex > filterIndex, "queue must sort only after filtering");
  assert.match(admin, /matchesEnvironment/);
  assert.match(admin, /haystack\.includes\(search\)/);
});

test("admin explains the automatic ordering while preserving V438 priority cards", () => {
  assert.match(admin, /className="order-smart-queue-v439"/);
  assert.match(admin, /Priorité automatique/);
  assert.match(
    admin,
    /Alertes → prêtes → préparation → nouvelles → attente/
  );
  assert.match(admin, /order-priority-v438/);
  assert.match(css, /Ichigo Ichie V4\.39 — Smart operational queue/);
  assert.match(css, /@media \(max-width: 720px\)/);
});
