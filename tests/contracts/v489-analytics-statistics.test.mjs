import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const collector = src("src/components/VercelTrafficAnalytics.tsx");
const providers = src("src/components/Providers.tsx");
const publicTrafficRoute = src("src/app/api/analytics/traffic/route.ts");
const trafficRoute = src("src/app/api/admin/analytics/traffic/route.ts");
const conversionRoute = src("src/app/api/admin/analytics/conversion/route.ts");
const trafficAdmin = src("src/components/admin/TrafficAnalyticsAdmin.tsx");
const pilotage = src("src/components/admin/AdminPilotage.tsx");
const productCard = src("src/components/ProductCard.tsx");

test("V489 keeps Vercel Web Analytics on production without counting admin or API routes", () => {
  assert.match(collector, /www\.ichigoichiematcha\.fr/);
  assert.match(collector, /\/_vercel\/insights\/script\.js/);
  assert.match(collector, /beforeSend/);
  assert.match(collector, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(collector, /pathname\.startsWith\("\/api\/"\)/);
  assert.match(providers, /<VercelTrafficAnalytics \/>/);
});

test("V489.1 records first-party traffic by session without a Vercel API token", () => {
  assert.match(collector, /usePathname/);
  assert.match(collector, /ichigo:traffic-session:v4891/);
  assert.match(collector, /window\.sessionStorage/);
  assert.match(collector, /TRAFFIC_ENDPOINT = "\/api\/analytics\/traffic"/);
  assert.match(publicTrafficRoute, /\.from\("conversion_events"\)\.insert/);
  assert.match(publicTrafficRoute, /event: "product_view"/);
  assert.match(publicTrafficRoute, /product_id: null/);
  assert.match(publicTrafficRoute, /isLikelyBot/);

  assert.match(trafficRoute, /requireAdmin\(request\)/);
  assert.match(trafficRoute, /\.from\("conversion_events"\)/);
  assert.match(trafficRoute, /\.eq\("event", "product_view"\)/);
  assert.match(trafficRoute, /\.is\("product_id", null\)/);
  assert.match(trafficRoute, /\.like\("session_id", "traffic-%"\)/);
  assert.doesNotMatch(
    trafficRoute,
    /VERCEL_ANALYTICS_TOKEN|VERCEL_ACCESS_TOKEN|api\.vercel\.com/,
  );
});

test("V489.1 keeps first-party pageviews out of product conversion metrics", () => {
  assert.match(conversionRoute, /const conversionRows = rows\.filter/);
  assert.match(conversionRoute, /row\.event !== "product_view"/);
  assert.match(conversionRoute, /UUID_RE\.test\(row\.product_id\)/);
  assert.match(conversionRoute, /conversionRows\.filter/);
  assert.match(conversionRoute, /new Set\(conversionRows\.map/);
});

test("V489.3 captures approximate country and city without persisting IP", () => {
  assert.match(publicTrafficRoute, /x-vercel-ip-country/);
  assert.match(publicTrafficRoute, /x-vercel-ip-city/);
  assert.match(publicTrafficRoute, /scope: "analytics:traffic:v4893"/);
  assert.match(publicTrafficRoute, /variant_id: country \? `geo:\$\{country\}` : null/);
  assert.match(publicTrafficRoute, /transaction_ref: city \|\| null/);
  assert.doesNotMatch(publicTrafficRoute, /x-forwarded-for|request\.ip|client_ip|ip_address/);

  assert.match(trafficRoute, /variant_id,transaction_ref/);
  assert.match(trafficRoute, /const countryBuckets = new Map/);
  assert.match(trafficRoute, /const cityBuckets = new Map/);
  assert.match(trafficRoute, /topCountries/);
  assert.match(trafficRoute, /topCities/);
});

test("V489.3 reports product-card clicks from existing product modal analytics", () => {
  assert.match(productCard, /source: "product_modal"/);
  assert.match(trafficRoute, /\.eq\("source", "product_modal"\)/);
  assert.match(trafficRoute, /const topProductClicks/);
  assert.match(trafficRoute, /totalProductClicks/);
  assert.match(trafficAdmin, /Clics produit/);
  assert.match(trafficAdmin, /Produits les plus cliqués/);
});

test("V489.3 exposes visits, geo and product clicks in admin pilotage", () => {
  assert.match(pilotage, /\| "traffic"/);
  assert.match(pilotage, /id: "traffic", label: "Trafic"/);
  assert.match(pilotage, /<TrafficAnalyticsAdmin supabase=\{supabase\} \/>/);
  assert.match(trafficAdmin, /Visites/);
  assert.match(trafficAdmin, /Pages vues/);
  assert.match(trafficAdmin, /Pages \/ visite/);
  assert.match(trafficAdmin, /<h4>Pays<\/h4>/);
  assert.match(trafficAdmin, /<h4>Villes<\/h4>/);
  assert.match(trafficAdmin, /data-traffic-version="v4893"/);
  assert.match(trafficAdmin, /PERIODS = \[7, 30\]/);
  assert.doesNotMatch(trafficAdmin, /VERCEL_ANALYTICS_TOKEN/);
});
