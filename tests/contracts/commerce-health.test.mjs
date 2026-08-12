import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const commerceHealth = source("src/lib/commerce-health.ts");
const systemHealth = source("src/app/api/admin/system-health/route.ts");
const productionUi = source("src/components/ProductionAdmin.tsx");

test("commerce health detects stale stock and promo reservations", () => {
  assert.match(commerceHealth, /stock_reserved\.eq\.true,promo_reserved\.eq\.true/);
  assert.match(commerceHealth, /payment_expires_at/);
  assert.match(
    commerceHealth,
    /paymentStatus === "failed" \|\| paymentStatus === "expired"/,
  );
  assert.match(commerceHealth, /STALE_WITHOUT_EXPIRY_MS = 45 \* 60 \* 1000/);
  assert.match(commerceHealth, /EXPIRY_GRACE_MS = 5 \* 60 \* 1000/);
});

test("paid stock reservation is not falsely classified as a stock leak", () => {
  assert.match(
    commerceHealth,
    /const stockLeak = Boolean\(order\.stock_reserved\) && !moneyAlreadyProcessed/,
  );
  for (const state of ["paid", "refunded", "refund_pending", "refund_failed"]) {
    assert.ok(commerceHealth.includes(`"${state}"`), `missing processed state ${state}`);
  }
});

test("promo reserved_count is checked against all reserved orders", () => {
  assert.match(commerceHealth, /\.eq\("promo_reserved", true\)/);
  assert.match(commerceHealth, /reservationsByPromo/);
  assert.match(commerceHealth, /reservedCount === orderReservations/);
});

test("inventory alerts use variant stock when variants exist", () => {
  assert.match(commerceHealth, /LOW_STOCK_THRESHOLD = 3/);
  assert.match(commerceHealth, /activeVariantCount/);
  assert.match(
    commerceHealth,
    /if \(\(activeVariantCount\.get\(String\(product\.id\)\) \?\? 0\) > 0\) continue/,
  );
  assert.match(commerceHealth, /severity: stock <= 0 \? "out" : "low"/);
});

test("system health exposes reservation and inventory checks", () => {
  assert.match(systemHealth, /collectCommerceHealth/);
  assert.match(systemHealth, /id: "reservations"/);
  assert.match(systemHealth, /id: "inventory"/);
  assert.match(systemHealth, /commerceHealth,/);
});

test("commerce health is diagnostic only and never mutates reservations", () => {
  assert.doesNotMatch(commerceHealth, /\.update\(/);
  assert.doesNotMatch(commerceHealth, /\.delete\(/);
  assert.doesNotMatch(commerceHealth, /\.rpc\(/);
  assert.match(productionUi, /Diagnostic en lecture seule/);
});

test("admin renders reservation, promo mismatch and low-stock details", () => {
  assert.match(productionUi, /Stock & réservations/);
  assert.match(productionUi, /Commandes à vérifier/);
  assert.match(productionUi, /Compteurs de codes promo/);
  assert.match(productionUi, /Alertes stock Boutique/);
  assert.match(productionUi, /Stock encore réservé/);
});
