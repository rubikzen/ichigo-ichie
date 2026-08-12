import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const adminApi = source("src/app/api/admin/orders/[id]/route.ts");
const adminUi = source("src/components/admin/AdminOrders.tsx");
const orderEmail = source("src/lib/order-email.ts");
const orderTracker = source("src/components/OrderTracker.tsx");

test("shipping cannot be completed without a tracking number", () => {
  assert.match(
    adminApi,
    /order\.order_type === "shipping" && status === "completed" && !trackingNumber/,
  );
  assert.match(
    adminApi,
    /Ajoutez le numéro de suivi avant de marquer le colis comme expédié/,
  );
});

test("shipping email is attempted only after the order update succeeds", () => {
  const updateIndex = adminApi.indexOf(
    'const { error: updateError } = await supabase.from("orders").update(patch)',
  );
  const emailIndex = adminApi.indexOf(
    'sendOrderEmail(supabase, id, "shipping")',
  );

  assert.notEqual(updateIndex, -1, "order update contract missing");
  assert.notEqual(emailIndex, -1, "shipping email contract missing");
  assert.ok(
    updateIndex < emailIndex,
    "shipping email must happen after the order update",
  );
  assert.match(
    adminApi,
    /order\.order_type === "shipping" && status === "completed"/,
  );
});

test("shipping email remains idempotent", () => {
  assert.match(orderEmail, /shipping_email_sent_at/);
  assert.match(orderEmail, /reason: "already_sent"/);
  assert.match(orderEmail, /Idempotency-Key/);
  assert.match(orderEmail, /const idempotencySuffix = options\.idempotencySuffix/);
  assert.match(
    orderEmail,
    /idempotencyKey: `\$\{kind\}-\$\{order\.id\}\$\{idempotencySuffix\}`/,
  );
});

test("admin exposes every shipping email delivery outcome", () => {
  for (const state of [
    "sent",
    "already_sent",
    "missing_recipient",
    "email_not_configured",
    "failed",
  ]) {
    assert.ok(adminApi.includes(`"${state}"`), `API missing state ${state}`);
    assert.ok(
      adminUi.includes(`result === "${state}"`),
      `Admin UI missing state ${state}`,
    );
  }
});

test("customer tracking renders carrier, number and external tracking link", () => {
  assert.match(
    orderTracker,
    /order\.tracking_carrier \|\| order\.shipping_method_name \|\| "Transporteur"/,
  );
  assert.match(orderTracker, /\{order\.tracking_number\}/);
  assert.match(orderTracker, /href=\{order\.tracking_url\}/);
  assert.match(orderTracker, /Suivre mon colis ↗/);
});
