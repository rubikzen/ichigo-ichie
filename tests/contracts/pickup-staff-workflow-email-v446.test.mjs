import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const migration = src("supabase/migrations/20260818180000_pickup_staff_workflow_email.sql");
const email = src("src/lib/order-email.ts");
const stripe = src("src/lib/stripe.ts");
const orders = src("src/app/api/orders/route.ts");
const scan = src("src/app/api/pickup-staff/scan/route.ts");
const statusRoute = src("src/app/api/pickup-staff/status/route.ts");
const scanner = src("src/components/PickupScanner.tsx");
const css = src("src/app/styles/globals-04.css");

test("V446 persists staff notification separately from merchant notification", () => {
  assert.ok(migration.includes("pickup_staff_notification_sent_at timestamptz"));
  assert.ok(email.includes("pickup_staff_notification_sent_at"));
  assert.ok(email.includes("merchant_notification_sent_at"));
});

test("pickup staff recipients come from pickup_staff identities and Supabase Auth", () => {
  assert.ok(email.includes('.from("pickup_staff")'));
  assert.ok(email.includes("supabase.auth.admin.getUserById"));
  assert.ok(email.includes("recipient.userId"));
});

test("staff alert is limited to paid pickup orders and persistently idempotent", () => {
  assert.ok(email.includes('order.order_type !== "pickup"'));
  assert.ok(email.includes('order.payment_status !== "paid"'));
  assert.ok(email.includes("order.pickup_staff_notification_sent_at"));
  assert.ok(email.includes("pickup-staff-paid-${order.id}-${recipient.userId}"));
});

test("staff alert contains operational details and a signed scanner link only", () => {
  const start = email.indexOf("export async function sendPickupStaffOrderNotification");
  const part = email.slice(start);
  assert.ok(part.includes("createPickupQrPayload(order.id)"));
  assert.ok(part.includes('/retrait?pickup=${encodeURIComponent('));
  assert.ok(part.includes("Articles à préparer"));
  assert.equal(part.includes("order.customer_email"), false);
  assert.equal(part.includes("order.customer_phone"), false);
  assert.equal(part.includes("order.total"), false);
  assert.equal(part.includes("/admin"), false);
});

test("canonical Stripe paid pipeline sends the employee alert", () => {
  assert.ok(stripe.includes("sendPickupStaffOrderNotification"));
  const paid = stripe.slice(stripe.indexOf("export async function markStripeOrderPaid"));
  assert.ok(paid.includes("await sendPickupStaffOrderNotification(supabase, orderId)"));
});

test("zero-total paid pickup orders also notify staff", () => {
  assert.ok(orders.includes("await sendPickupStaffOrderNotification(supabase, order.id)"));
});

test("scan API exposes exact workflow stage and safe forward actions", () => {
  assert.ok(scan.includes("workflowStatus: canRevealPickupDetails ? order.status : undefined"));
  assert.ok(scan.includes('order.status === "pending"'));
  assert.ok(scan.includes('order.status === "preparing"'));
  assert.ok(scan.includes("canMarkReady"));
  assert.ok(scan.includes("canHandoff"));
});

test("staff workflow API requires staff auth and signed pickup token", () => {
  assert.ok(statusRoute.includes("requirePickupStaff(request)"));
  assert.ok(statusRoute.includes("verifyPickupQrPayload(body.qr)"));
  assert.ok(statusRoute.includes('const TARGETS = new Set(["preparing", "ready"])'));
});

test("workflow enforces paid pending to preparing to ready atomically", () => {
  assert.ok(statusRoute.includes('target === "preparing" ? "pending" : "preparing"'));
  assert.ok(statusRoute.includes('order.payment_status !== "paid"'));
  assert.ok(statusRoute.includes('.eq("payment_status", "paid")'));
  assert.ok(statusRoute.includes('.eq("status", expectedCurrent)'));
});

test("marking ready from staff reuses pickup_ready customer e-mail", () => {
  assert.ok(statusRoute.includes('target === "ready"'));
  assert.ok(statusRoute.includes('"pickup_ready"'));
  assert.ok(statusRoute.includes("sendOrderEmail("));
});

test("staff e-mail deep link auto-opens the exact pickup after login", () => {
  assert.ok(scanner.includes('searchParams.get("pickup")'));
  assert.ok(scanner.includes("linkedPickupLoadedRef"));
  assert.ok(scanner.includes("await inspectQr(linkedPickup, true)"));
});

test("scanner exposes preparation ready and handoff without an order list", () => {
  assert.ok(scanner.includes("Commencer la préparation"));
  assert.ok(scanner.includes("Marquer comme prête"));
  assert.ok(scanner.includes("Confirmer la remise"));
  assert.ok(scanner.includes("Aucune liste de commandes n’est accessible"));
  assert.equal(scanner.includes("Rechercher une commande"), false);
  assert.ok(css.includes("Ichigo Ichie V4.46 — Pickup staff workflow"));
});
