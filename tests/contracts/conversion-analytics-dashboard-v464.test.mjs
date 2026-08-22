import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const migration = src("supabase/migrations/20260821180500_conversion_analytics_v464.sql");
const publicRoute = src("src/app/api/analytics/conversion/route.ts");
const persistence = src("src/lib/conversion-analytics-server.ts");
const adminRoute = src("src/app/api/admin/analytics/conversion/route.ts");
const component = src("src/components/admin/ConversionAnalyticsAdmin.tsx");
const pilotage = src("src/components/admin/AdminPilotage.tsx");
const adminOrders = src("src/components/admin/AdminOrders.tsx");
const css = src("src/app/styles/globals-04.css");

test("V464 persists only the four V463 funnel events in a private table", () => {
  assert.match(migration, /create table if not exists public\.conversion_events/);
  for (const event of ["product_view", "add_to_cart", "begin_checkout", "purchase"]) {
    assert.ok(migration.includes(`'${event}'`));
  }
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on table public\.conversion_events from anon, authenticated/);
  const migrationSchema = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(
    migrationSchema,
    /customer_|email|phone|address|user_agent|ip_address/i,
  );
});

test("V464 persistence stays server-only, rate-limited and best-effort", () => {
  assert.match(persistence, /createServiceSupabase/);
  assert.match(persistence, /consumeRateLimit/);
  assert.match(persistence, /analytics:conversion:v464/);
  assert.match(persistence, /process\.env\.E2E_LOCAL/);
  assert.match(persistence, /process\.env\.NODE_ENV/);
  assert.match(persistence, /process\.env\.VERCEL_ENV/);
  assert.match(persistence, /return false/);
  assert.doesNotMatch(publicRoute, /createServiceSupabase|supabase/i);
  assert.match(publicRoute, /await persistConversionEvent\(request, record\)/);
});

test("V464 keeps server time authoritative and never stores raw order numbers", () => {
  assert.match(publicRoute, /occurred_at:\s*new Date\(\)\.toISOString\(\)/);
  assert.match(publicRoute, /transaction_ref:/);
  assert.match(publicRoute, /createHash\("sha256"\)/);
  assert.doesNotMatch(persistence, /transaction_id/);
});

test("V464 admin analytics requires the canonical admin authorization", () => {
  assert.match(adminRoute, /requireAdmin\(request\)/);
  assert.match(adminRoute, /new Set\(\[7, 30, 90\]\)/);
  assert.match(adminRoute, /\.from\("conversion_events"\)/);
  assert.match(adminRoute, /cache-control/);
});

test("V464 dashboard exposes funnel, revenue and 7 30 90 day controls", () => {
  assert.match(component, /ConversionAnalyticsAdmin/);
  assert.match(component, /PERIODS = \[7, 30, 90\]/);
  assert.match(adminRoute, /label:\s*"Vues produit"/);
  assert.match(component, /\{step\.label\}/);
  assert.match(component, /CA attribué/);
  assert.match(component, /\/api\/admin\/analytics\/conversion\?days=/);
  assert.match(component, /authorization: `Bearer \$\{token\}`/);
});

test("V464 analytics remains in the dedicated V476 Pilotage workspace", () => {
  assert.match(pilotage, /import \{ ConversionAnalyticsAdmin \}/);
  assert.match(pilotage, /section === "conversion"/);
  assert.match(pilotage, /<ConversionAnalyticsAdmin supabase=\{supabase\} \/>/);
  assert.doesNotMatch(adminOrders, /ConversionAnalyticsAdmin|Pilotage Boutique/);
});

test("V464 product ranking does not invent purchase attribution and stays responsive", () => {
  assert.match(adminRoute, /row\.event !== "product_view" && row\.event !== "add_to_cart"/);
  assert.match(component, /sans inventer d’attribution produit sur l’achat/);
  assert.match(css, /conversion-analytics-v464/);
  assert.match(css, /@media \(max-width: 640px\)/);
});
