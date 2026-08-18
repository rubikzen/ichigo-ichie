import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(resolve(root, "src/components/admin/AdminOrders.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V442 replaces the ellipsis menu with an explicit action rail", () => {
  assert.match(admin, /order-action-rail-v442/);
  assert.doesNotMatch(admin, /moreActionsOrderId/);
  assert.doesNotMatch(admin, /setMoreActionsOrderId/);
  assert.doesNotMatch(admin, /order-more-menu-v249/);
});

test("status is read-only by default and editing requires an explicit action", () => {
  assert.match(admin, /statusEditOrderId/);
  assert.match(admin, /order-status-card-v442/);
  assert.match(admin, />\s*Modifier le statut\s*</);
  assert.match(admin, /statusEditOrderId === order\.id/);
});

test("completed pickup communicates Terminée and Retrait terminé", () => {
  assert.match(admin, /order\.status === "completed"[\s\S]*"Terminée"/);
  assert.match(admin, /order\.status === "completed"[\s\S]*"Retrait terminé\."/);
});

test("documents are grouped directly and invoice resend is not duplicated in the rail", () => {
  assert.match(admin, />DOCUMENTS</);
  assert.match(admin, />\s*Facture PDF ↓\s*</);
  assert.match(admin, />\s*Créer la facture\s*</);
  assert.match(admin, />\s*Créer l’avoir\s*</);
  assert.match(admin, />\s*Avoir PDF ↓\s*</);
  const start = admin.indexOf('className="order-actions order-action-rail-v442"');
  const end = admin.indexOf("</aside>", start);
  assert.doesNotMatch(admin.slice(start, end), />Renvoyer la facture</);
});

test("customer view is a full explicit action", () => {
  assert.match(admin, />CLIENT</);
  assert.match(admin, /order-client-view-v442/);
  assert.match(admin, />\s*Voir la commande client ↗\s*</);
});

test("refund is isolated as a sensitive action and keeps confirmation", () => {
  assert.match(admin, /order-danger-zone-v442/);
  assert.match(admin, />ACTION SENSIBLE</);
  assert.match(admin, /window\.confirm\(`Rembourser \$\{order\.order_number\} via Stripe \?`\)/);
});

test("payment blocking and cancellation remain available", () => {
  assert.match(admin, /paymentBlocked &&/);
  assert.match(admin, />PAIEMENT</);
  assert.match(admin, />\s*Annuler la commande\s*</);
});

test("V442 preserves V440 quick actions and email recovery", () => {
  assert.match(admin, /order-quick-action-v440/);
  assert.match(admin, /order-email-recovery-v373/);
  assert.match(admin, /Le renvoi de facture reste dans « E-mails client »/);
});

test("action rail is responsive and touch-friendly", () => {
  assert.match(css, /Ichigo Ichie V4\.42 — Admin order action rail/);
  assert.match(css, /@media \(max-width:980px\)/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:720px\)[\s\S]*grid-template-columns:1fr/);
  assert.match(css, /min-height:44px/);
});
