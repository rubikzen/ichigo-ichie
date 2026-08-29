import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const collector = src("src/components/VercelTrafficAnalytics.tsx");
const providers = src("src/components/Providers.tsx");
const trafficRoute = src("src/app/api/admin/analytics/traffic/route.ts");
const trafficAdmin = src("src/components/admin/TrafficAnalyticsAdmin.tsx");
const pilotage = src("src/components/admin/AdminPilotage.tsx");

test("V489 collects production traffic without counting admin or API routes", () => {
  assert.match(collector, /www\.ichigoichiematcha\.fr/);
  assert.match(collector, /\/_vercel\/insights\/script\.js/);
  assert.match(collector, /beforeSend/);
  assert.match(collector, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(collector, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(providers, /<VercelTrafficAnalytics \/>/);
});

test("V489 keeps Vercel analytics credentials on the server", () => {
  assert.match(trafficRoute, /requireAdmin\(request\)/);
  assert.match(trafficRoute, /process\.env\.VERCEL_ANALYTICS_TOKEN/);
  assert.match(trafficRoute, /process\.env\.VERCEL_ACCESS_TOKEN/);
  assert.match(trafficRoute, /web-analytics\/visits\/count/);
  assert.match(trafficRoute, /authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(collector, /VERCEL_ANALYTICS_TOKEN/);
  assert.doesNotMatch(trafficAdmin, /VERCEL_ACCESS_TOKEN/);
});

test("V489 exposes traffic statistics in the admin pilotage workspace", () => {
  assert.match(pilotage, /\| "traffic"/);
  assert.match(pilotage, /id: "traffic", label: "Trafic"/);
  assert.match(pilotage, /<TrafficAnalyticsAdmin supabase=\{supabase\} \/>/);
  assert.match(trafficAdmin, /Visiteurs/);
  assert.match(trafficAdmin, /Pages vues/);
  assert.match(trafficAdmin, /Pages \/ visiteur/);
  assert.match(trafficAdmin, /PERIODS = \[7, 30\]/);
});
