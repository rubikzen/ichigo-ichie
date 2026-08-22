import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const dashboard = src("src/components/AdminDashboard.tsx");
const today = src("src/components/admin/AdminToday.tsx");
const pilotage = src("src/components/admin/AdminPilotage.tsx");
const stockHub = src("src/components/admin/AdminStockHub.tsx");
const orders = src("src/components/admin/AdminOrders.tsx");
const catalog = src("src/components/admin/AdminCatalog.tsx");
const settings = src("src/components/admin/AdminSettings.tsx");
const css = src("src/app/styles/globals-04.css");

test("V476 reduces top-level admin navigation to six task-oriented workspaces and defaults to Aujourd’hui", () => {
  assert.match(
    today,
    /export type AdminArea =[\s\S]*?"today"[\s\S]*?"orders"[\s\S]*?"catalog"[\s\S]*?"pilotage"[\s\S]*?"site"[\s\S]*?"system"/,
  );
  assert.match(dashboard, /useState<AdminArea>\("today"\)/);
  assert.match(dashboard, /today: "Aujourd’hui"/);
  assert.match(dashboard, /orders: "Commandes"/);
  assert.match(dashboard, /catalog: "Catalogue"/);
  assert.match(dashboard, /pilotage: "Pilotage"/);
  assert.match(dashboard, /site: "Site"/);
  assert.match(dashboard, /system: "Système"/);
  assert.doesNotMatch(dashboard, /type Tab = "products"/);
});

test("V476 gives orders catalogue and site focused secondary navigation", () => {
  assert.match(dashboard, /type OrdersSection = "orders" \| "invoices"/);
  assert.match(
    dashboard,
    /type CatalogSection = "products" \| "categories" \| "stock" \| "promos"/,
  );
  assert.match(dashboard, /type SiteSection = "settings" \| "messages"/);
  assert.match(dashboard, /Stock & réappro/);
  assert.match(dashboard, /Réglages du site/);
});

test("V476 Aujourd’hui is action-oriented and routes each signal to the exact workspace", () => {
  assert.match(today, /Ce qui demande votre attention/);
  assert.match(today, /onNavigate\("orders", "orders"\)/);
  assert.match(today, /onNavigate\("site", "messages"\)/);
  assert.match(today, /onNavigate\("pilotage", "reviews"\)/);
  assert.match(today, /onNavigate\("catalog", "stock"\)/);
  assert.match(today, /onNavigate\("pilotage", "seo"\)/);
  assert.match(today, /Lecture seule/);
});

test("V476 Today batches order review restock SEO and forecast signals without writing data", () => {
  assert.match(today, /Promise\.all/);
  assert.match(today, /\.from\("orders"\)/);
  assert.match(today, /\.from\("product_reviews"\)/);
  assert.match(today, /\.from\("restock_subscriptions"\)/);
  assert.match(today, /\/api\/admin\/seo-health/);
  assert.match(today, /\/api\/admin\/inventory-forecast\?days=30/);
  assert.doesNotMatch(today, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});

test("V476 Pilotage mounts only the selected heavy dashboard and keeps stock as an operational jump", () => {
  assert.match(pilotage, /section === "sales"/);
  assert.match(pilotage, /section === "conversion"/);
  assert.match(pilotage, /section === "seo"/);
  assert.match(pilotage, /section === "reviews"/);
  assert.match(pilotage, /<OrderStatistics/);
  assert.match(pilotage, /<ConversionAnalyticsAdmin/);
  assert.match(pilotage, /<SeoHealthAdmin/);
  assert.match(pilotage, /<ProductReviewsAdmin/);
  assert.match(pilotage, /onNavigate\("catalog", "stock"\)/);
});

test("V476 removes analytics SEO forecast and reviews from the order workflow", () => {
  assert.doesNotMatch(orders, /Pilotage Boutique/);
  assert.doesNotMatch(orders, /OrderStatistics/);
  assert.doesNotMatch(orders, /ConversionAnalyticsAdmin/);
  assert.doesNotMatch(orders, /SeoHealthAdmin/);
  assert.doesNotMatch(orders, /InventoryForecastAdmin/);
  assert.doesNotMatch(orders, /ProductReviewsAdmin/);
  assert.match(orders, /Priorité automatique/);
});

test("V476 consolidates forecast and restock demand in one dedicated stock workspace", () => {
  assert.match(stockHub, /<InventoryForecastAdmin supabase=\{supabase\} \/>/);
  assert.match(stockHub, /<RestockWaitlistAdmin/);
  assert.match(stockHub, /\.eq\("kind", "shop"\)/);
  assert.match(stockHub, /\.from\("products"\)/);
  assert.match(stockHub, /\.from\("product_variants"\)/);
  assert.doesNotMatch(catalog, /RestockWaitlistAdmin/);
});

test("V476 preserves the proven quick product editor instead of replacing it", () => {
  assert.match(catalog, /Modification rapide/);
  assert.match(catalog, /Prix, stock, poids, visibilité et ordre/);
  assert.match(catalog, /À revoir · \$\{shopContentReviewCount\}/);
  assert.match(catalog, /quickPatchProduct/);
  assert.match(catalog, /chooseProduct/);
});

test("V476 reorganizes site settings by editing intent while preserving the same settings engine", () => {
  const identity = settings.indexOf('{ id: "identity"');
  const home = settings.indexOf('{ id: "home"');
  const shop = settings.indexOf('{ id: "shop"');
  const menu = settings.indexOf('{ id: "menu"');
  const media = settings.indexOf('{ id: "media"');
  assert.ok(identity >= 0 && home > identity && shop > home && menu > shop && media > menu);
  assert.match(settings, /group: "Entreprise"/);
  assert.match(settings, /group: "Visibilité"/);
  assert.match(settings, /group: "Avancé"/);
  assert.match(settings, /Boutique physique & footer/);
  assert.match(settings, /hasUnsavedChanges/);
  assert.match(settings, /formRef\.current\?\.requestSubmit/);
});

test("V476 navigation and dashboard cards remain usable on tablet and mobile", () => {
  assert.match(css, /V476 — admin information architecture/);
  assert.match(css, /admin-primary-nav-v476/);
  assert.match(css, /admin-secondary-nav-v476/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /overflow-x: auto/);
});

test("V476 is an information-architecture change with no migration or commerce mutation", () => {
  const newIa = [dashboard, today, pilotage, stockHub].join("\n");
  assert.doesNotMatch(newIa, /supabase\/migrations/);
  assert.doesNotMatch(newIa, /stock\s*[-+]=/);
  assert.doesNotMatch(today, /from\("order_items"\)/);
  assert.doesNotMatch(pilotage, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
});
