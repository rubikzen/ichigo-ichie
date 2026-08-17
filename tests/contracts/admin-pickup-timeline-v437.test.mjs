import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(resolve(root, "src/components/admin/AdminOrders.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");

test("V437 renders a dedicated four-step pickup timeline only for active pickup orders", () => {
  assert.match(admin, /pickupFlowActive =\s*order\.order_type === "pickup"/);
  for (const label of ["Confirmée", "En préparation", "Prête", "Remise"]) {
    assert.ok(admin.includes(`label: "${label}"`), `missing pickup step ${label}`);
  }
  assert.match(admin, /className="pickup-admin-timeline-v437"/);
});

test("pickup progress is derived from status without inventing a preparation timestamp", () => {
  assert.match(admin, /const pickupStatusRank =/);
  assert.match(admin, /order\.status === "completed"/);
  assert.match(admin, /order\.status === "ready"/);
  assert.match(admin, /order\.status === "preparing"/);
  assert.doesNotMatch(admin, /pickup_preparing_email_sent_at/);
});

test("preparation is explicitly internal and sends no customer email", () => {
  assert.match(admin, /Étape interne · aucun e-mail client/);
  assert.match(admin, /Prochaine action : passer à Prête — l’e-mail de retrait sera envoyé/);
});

test("ready and completed steps expose real delivery markers and missing-email attention", () => {
  assert.match(admin, /order\.pickup_ready_email_sent_at/);
  assert.match(admin, /order\.pickup_completed_email_sent_at/);
  assert.match(admin, /E-mail « prête à retirer » à vérifier/);
  assert.match(admin, /E-mail de fin de retrait à vérifier/);
  assert.match(admin, /step\.attention \? " attention" : ""/);
});

test("timeline explains the next pickup action without changing status actions", () => {
  assert.match(admin, /Prochaine action : préparer la commande/);
  assert.match(admin, /confirmer Remise — l’e-mail final sera envoyé/);
  assert.match(admin, /Retrait terminé/);
  assert.match(admin, /updateOrder\(order\.id, "preparing"\)/);
  assert.match(admin, /updateOrder\(order\.id, "ready"\)/);
});

test("production guidance distinguishes pickup from shipping flow", () => {
  assert.match(admin, /Retrait : paiement confirmé → préparation → prête → remise/);
  assert.match(admin, /Livraison : paiement confirmé → préparation → suivi colis → expédition/);
});

test("V437 timeline is responsive from four to two to one column", () => {
  assert.match(css, /Ichigo Ichie V4\.37 — Admin pickup timeline/);
  assert.match(css, /grid-template-columns: repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*grid-template-columns: 1fr/);
});
