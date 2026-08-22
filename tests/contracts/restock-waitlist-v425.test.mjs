import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const product = readFileSync(resolve(root, "src/components/ProductCard.tsx"), "utf8");
const notify = readFileSync(resolve(root, "src/components/RestockNotify.tsx"), "utf8");
const api = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260815184000_restock_waitlist.sql"), "utf8");
const stockHub = readFileSync(resolve(root, "src/components/admin/AdminStockHub.tsx"), "utf8");
const admin = readFileSync(resolve(root, "src/components/admin/AdminCatalog.tsx"), "utf8");
const waitlist = readFileSync(resolve(root, "src/components/admin/RestockWaitlistAdmin.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const v423 = readFileSync(resolve(root, "tests/contracts/sold-out-price-visibility-v423.test.mjs"), "utf8");

test("restock subscriptions are private, admin-readable and duplicate-safe", () => {
  assert.match(migration, /create table if not exists public\.restock_subscriptions/);
  assert.match(migration, /create unique index if not exists uq_restock_active_target_email/);
  assert.match(migration, /where status = 'active'/);
  assert.match(migration, /revoke all on table public\.restock_subscriptions from anon, authenticated/);
  assert.match(migration, /using \(public\.is_admin\(\)\)/);
  assert.match(migration, /grant select, insert, update, delete on table public\.restock_subscriptions to service_role/);
});

test("public restock API is rate-limited, validates stock and deduplicates email targets", () => {
  assert.match(api, /scope: "restock:subscribe"/);
  assert.match(api, /limit: 6/);
  assert.match(api, /windowSeconds: 600/);
  assert.match(api, /RESTOCK_EMAIL_INVALID/);
  assert.match(api, /const totalStock = variants\?\.length/);
  assert.match(api, /"RESTOCK_AVAILABLE"/);
  assert.match(api, /\.eq\("email", email\)[\s\S]*?\.eq\("status", "active"\)/);
  assert.match(api, /insertError\?\.code === "23505"/);
});

test("sold-out storefront cards replace dead unavailable CTA with a restock action", () => {
  assert.match(product, /\{isSoldOut \? \([\s\S]*?<RestockNotify/);
  assert.match(product, /context="card"/);
  assert.match(product, /productId=\{product\.id\}/);
  assert.doesNotMatch(product, /disabled=\{isSoldOut \|\|/);
});

test("sold-out modal also offers the same restock action without restoring its price", () => {
  assert.match(product, /\) : !hasStock \? \([\s\S]*?<RestockNotify/);
  assert.match(product, /context="modal"/);
  assert.match(v423, /exposes restock recovery/);
});

test("restock form is bilingual, purpose-limited and includes bot protection", () => {
  assert.match(notify, /Me prévenir du retour en stock/);
  assert.match(notify, /Notify me when back in stock/);
  assert.match(notify, /uniquement pour cette alerte de retour en stock/);
  assert.match(notify, /only be used for this back-in-stock alert/);
  assert.match(notify, /className="restock-honeypot-v425"/);
  assert.match(notify, /fetch\("\/api\/restock\/subscribe"/);
});

test("Boutique admin exposes the private restock dashboard in the dedicated V476 stock workspace", () => {
  assert.match(stockHub, /<RestockWaitlistAdmin/);
  assert.match(stockHub, /\.eq\("kind", "shop"\)/);
  assert.doesNotMatch(admin, /RestockWaitlistAdmin/);
  assert.match(waitlist, /\.from\("restock_subscriptions"\)/);
  assert.match(waitlist, /useState<WaitlistStatus>\("active"\)/);
  assert.match(waitlist, /\.eq\("status", activeTab\)/);
  assert.match(waitlist, /Alertes retour en stock/);
  assert.match(css, /Ichigo Ichie V4\.25 — Restock waitlist/);
});
