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

test("V440 defines UI-only quick actions and does not create a backend status model", () => {
  assert.match(admin, /type QuickOrderAction =/);
  assert.match(admin, /kind: "status"/);
  assert.match(admin, /kind: "tracking"/);
  assert.doesNotMatch(admin, /quick_action_status/);
  assert.doesNotMatch(admin, /quick_action_at/);
});

test("quick actions are gated by V438 action priority and production readiness", () => {
  assert.match(
    admin,
    /orderPriority\.tone !== "action" \|\| !orderReadyForProduction\(order\)/
  );
  assert.match(admin, /const quickAction: QuickOrderAction \| null/);
});

test("new production-ready orders can move to preparation directly without email confirmation", () => {
  assert.match(
    admin,
    /order\.status === "pending"[\s\S]*target: "preparing"[\s\S]*label: "Préparer"[\s\S]*confirm: false/
  );
});

test("pickup ready transition is explicitly two-step because it sends the ready email", () => {
  assert.match(
    admin,
    /order\.status === "preparing"[\s\S]*order\.order_type === "pickup"[\s\S]*target: "ready"[\s\S]*confirm: true[\s\S]*Confirmer Prête \+ e-mail/
  );
  assert.match(admin, /Enverra l’e-mail « prête au retrait » au client/);
});

test("shipping can become colis prêt directly because that stage does not send a customer email", () => {
  assert.match(
    admin,
    /target: "ready"[\s\S]*label: "Colis prêt"[\s\S]*Aucun e-mail client à cette étape[\s\S]*confirm: false/
  );
});

test("pickup handoff and shipping completion require inline confirmation before customer email", () => {
  assert.match(
    admin,
    /label: "Remise"[\s\S]*confirm: true[\s\S]*Confirmer Remise \+ e-mail/
  );
  assert.match(
    admin,
    /label: "Expédier"[\s\S]*confirm: true[\s\S]*Confirmer Expédiée \+ e-mail/
  );
  assert.match(admin, /className="order-quick-confirm-actions-v440"/);
  assert.match(admin, />\s*Annuler\s*</);
});

test("shipping without tracking opens the existing tracking editor instead of completing the order", () => {
  assert.match(
    admin,
    /order\.tracking_number[\s\S]*kind: "tracking"[\s\S]*label: "Ajouter suivi"/
  );
  assert.match(admin, /function openQuickTracking\(order: OrderRow\)/);
  assert.match(admin, /setExpandedOrderId\(order\.id\)/);
  assert.match(admin, /toggleTrackingEditor\(order\)/);
});

test("quick actions reuse canonical update functions and protect against duplicate clicks", () => {
  assert.match(admin, /function quickStatusKey/);
  assert.match(admin, /if \(quickActionBusyKey\) return/);
  assert.match(admin, /await markOrderCompleted\(order\)/);
  assert.match(admin, /await updateOrder\(order\.id, target\)/);
  assert.doesNotMatch(admin, /\/api\/admin\/orders\/\$\{order\.id\}[\s\S]*V440/);
});

test("V440 stays on the collapsed card, responsive, and preserves details plus V437-V439 UX", () => {
  assert.match(admin, /className=\{`order-quick-action-v440/);
  assert.match(admin, /order-details-toggle-v248/);
  assert.match(admin, /order-priority-v438/);
  assert.match(admin, /order-smart-queue-v439/);
  assert.match(admin, /pickup-admin-timeline-v437/);
  assert.match(css, /Ichigo Ichie V4\.40 — Safe admin quick actions/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /min-height: 44px/);
});
