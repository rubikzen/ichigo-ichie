import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(resolve(root, "src/components/admin/AdminOrders.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V438 derives card priority from existing order truth without adding a new status", () => {
  assert.match(admin, /function orderPriorityMeta\(order: OrderRow\)/);
  assert.match(admin, /orderPriorityMeta\(order\)/);
  assert.doesNotMatch(admin, /priority_status/);
  assert.doesNotMatch(admin, /priority_updated_at/);
});

test("payment and refund exceptions are visible before production actions", () => {
  assert.match(admin, /payment_status === "refund_failed"[\s\S]*À VÉRIFIER/);
  assert.match(admin, /payment_status === "refund_pending"[\s\S]*STRIPE EN COURS/);
  assert.match(admin, /payment_status === "failed"[\s\S]*PAIEMENT ÉCHOUÉ/);
  assert.match(admin, /payment_status === "expired"[\s\S]*PAIEMENT EXPIRÉ/);
  assert.match(admin, /orderAwaitingPayment\(order\) \|\| !orderReadyForProduction\(order\)/);
});

test("normal fulfilment stages expose the next operational action on collapsed cards", () => {
  assert.match(admin, /order\.status === "pending"[\s\S]*À PRÉPARER/);
  assert.match(admin, /order\.status === "preparing"[\s\S]*À CONTINUER/);
  assert.match(admin, /order\.status === "ready"[\s\S]*À EXPÉDIER/);
  assert.match(admin, /À REMETTRE/);
});

test("shipping ready priority tells staff whether tracking is still missing", () => {
  assert.match(admin, /order\.tracking_number[\s\S]*Suivi enregistré · marquer expédiée/);
  assert.match(admin, /Ajouter le suivi puis expédier/);
});

test("missing lifecycle emails become operational alerts only when a customer email exists", () => {
  assert.match(admin, /order\.customer_email[\s\S]*pickup_ready_email_sent_at/);
  assert.match(admin, /pickup_completed_email_sent_at/);
  assert.match(admin, /shipping_email_sent_at/);
  assert.match(admin, /E-MAIL À VÉRIFIER/);
});

test("completed cancelled and refunded cards visibly leave the active work queue", () => {
  assert.match(admin, /order\.status === "cancelled"[\s\S]*ANNULÉE/);
  assert.match(admin, /order\.status === "refunded" \|\| order\.payment_status === "refunded"[\s\S]*REMBOURSÉE/);
  assert.match(admin, /order\.status === "completed"[\s\S]*Flux terminé/);
});

test("priority is rendered accessibly on the compact card without replacing detail controls", () => {
  assert.match(admin, /className=\{`order-priority-v438 \$\{orderPriority\.tone\}`\}/);
  assert.match(admin, /aria-label=\{`\$\{orderPriority\.label\} : \$\{orderPriority\.detail\}`\}/);
  assert.match(admin, /order-details-toggle-v248/);
  assert.match(admin, /admin-priority-\$\{orderPriority\.tone\}-v438/);
});

test("V438 priority styling stays responsive and V437 detail timeline remains intact", () => {
  assert.match(css, /Ichigo Ichie V4\.38 — Admin order card priority/);
  assert.match(css, /\.order-priority-v438\.action/);
  assert.match(css, /\.order-priority-v438\.waiting/);
  assert.match(css, /\.order-priority-v438\.alert/);
  assert.match(css, /\.order-priority-v438\.done/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*width: 100%/);
  assert.match(admin, /pickup-admin-timeline-v437/);
});
