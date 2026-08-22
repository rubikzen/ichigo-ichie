import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const model = src("src/lib/inventory-forecast.ts");
const route = src("src/app/api/admin/inventory-forecast/route.ts");
const admin = src("src/components/admin/InventoryForecastAdmin.tsx");
const stockHub = src("src/components/admin/AdminStockHub.tsx");
const orders = src("src/components/admin/AdminOrders.tsx");
const css = src("src/app/styles/globals-04.css");

test("V467 forecasting is deterministic and schema-free", () => {
  assert.match(model, /INVENTORY_FORECAST_PERIODS = \[30, 60, 90\]/);
  assert.match(model, /INVENTORY_TARGET_COVERAGE_DAYS = 30/);
  assert.match(model, /unitsSold \/ lookbackDays/);
  assert.match(model, /stock \/ dailyRate/);
  assert.match(model, /dailyRate \* targetCoverageDays/);
  assert.doesNotMatch(route, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("V467 endpoint is admin-only and follows the active commerce environment", () => {
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /getCommerceEnvironment\(\)/);
  assert.match(route, /\.eq\("environment", environment\)/);
  assert.match(route, /\.eq\("payment_status", "paid"\)/);
  assert.match(route, /isCancelledOrRefunded/);
  assert.match(route, /isBoutique/);
});

test("V467 attributes historical demand by product and variant IDs rather than product names", () => {
  assert.match(
    route,
    /\.select\("order_id,product_id,variant_id,quantity"\)/,
  );
  assert.match(route, /variant:\$\{variantId\}/);
  assert.match(route, /product:\$\{productId\}/);
  assert.doesNotMatch(
    route,
    /product_name[\s\S]*salesByStockUnit|salesByStockUnit[\s\S]*product_name/,
  );
});

test("V467 keeps variant inventory canonical and never forecasts a fake base stock for variant products", () => {
  assert.match(route, /activeVariantCount/);
  assert.match(
    route,
    /if \(\(activeVariantCount\.get\(productId\) \?\? 0\) > 0\) continue/,
  );
  assert.match(route, /kind: "variant"/);
  assert.match(route, /kind: "product"/);
});

test("V467 urgency thresholds map coverage into rupture 7 14 and 30 day signals", () => {
  assert.match(model, /stock <= 0[\s\S]*"out"/);
  assert.match(model, /coverageDays <= 7[\s\S]*"urgent"/);
  assert.match(model, /coverageDays <= 14[\s\S]*"order"/);
  assert.match(model, /coverageDays <= 30[\s\S]*"watch"/);
  assert.match(model, /"no_sales"/);
});

test("V467 suggested reorder targets 30 days without inventing demand when no sales exist", () => {
  assert.match(model, /targetStock =[\s\S]*dailyRate > 0/);
  assert.match(
    model,
    /suggestedOrder = Math\.max\(0, targetStock - Math\.floor\(stock\)\)/,
  );
  assert.match(
    model,
    /dailyRate > 0[\s\S]*Math\.ceil\(dailyRate \* targetCoverageDays\)[\s\S]*: 0/,
  );
});

test("V467 admin dashboard exposes period controls stock velocity coverage and suggested units", () => {
  assert.match(admin, /const PERIODS = \[30, 60, 90\]/);
  assert.match(admin, /Prévision de stock/);
  assert.match(admin, /Couverture/);
  assert.match(admin, /Vitesse/);
  assert.match(admin, /À commander/);
  assert.match(admin, /Réappro conseillé/);
  assert.match(admin, /Priorités/);
  assert.match(admin, /Tous les stocks/);
});

test("V467 forecast is consolidated in the V476 Stock and restock workspace", () => {
  assert.match(
    stockHub,
    /import \{ InventoryForecastAdmin \} from "\.\/InventoryForecastAdmin"/,
  );
  assert.match(
    stockHub,
    /<InventoryForecastAdmin supabase=\{supabase\} \/>/,
  );
  assert.doesNotMatch(orders, /InventoryForecastAdmin|Pilotage Boutique/);
});

test("V467 remains responsive and explicitly surfaces weak forecasting data", () => {
  assert.match(admin, /Données faibles/);
  assert.match(admin, /unmappedUnits/);
  assert.match(css, /V467 — deterministic stock forecasting/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
