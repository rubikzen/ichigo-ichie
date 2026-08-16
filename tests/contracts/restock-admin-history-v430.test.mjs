import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const waitlist = readFileSync(resolve(root, "src/components/admin/RestockWaitlistAdmin.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/app/styles/globals-04.css"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260815184000_restock_waitlist.sql"), "utf8");

test("restock admin dashboard exposes active notified and cancelled lifecycle tabs with exact counts", () => {
  assert.match(waitlist, /type WaitlistStatus = "active" \| "notified" \| "cancelled"/);
  assert.match(waitlist, /useState<WaitlistStatus>\("active"\)/);
  assert.match(waitlist, /label: "Actives"/);
  assert.match(waitlist, /label: "Envoyées"/);
  assert.match(waitlist, /label: "Annulées"/);
  assert.match(waitlist, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(waitlist, /\.eq\("status", "notified"\)/);
  assert.match(waitlist, /\.eq\("status", "cancelled"\)/);
});

test("history rows load lifecycle timestamps while remaining read-only", () => {
  assert.match(waitlist, /created_at,notified_at,cancelled_at/);
  assert.match(waitlist, /row\.notified_at/);
  assert.match(waitlist, /row\.cancelled_at/);
  assert.match(waitlist, /<b>Inscrite<\/b>/);
  assert.match(waitlist, /selectedStatus\.eventLabel/);
  assert.doesNotMatch(waitlist, /\.update\(/);
  assert.doesNotMatch(waitlist, /\.delete\(/);
});

test("restock history search covers email product and exact V429 format labels", () => {
  assert.match(waitlist, /type="search"/);
  assert.match(waitlist, /Email, produit ou format/);
  assert.match(waitlist, /const productName = productNames\.get\(row\.product_id\)/);
  assert.match(waitlist, /variantNames\.get\(row\.variant_id\)/);
  assert.match(waitlist, /`\$\{row\.email\} \$\{productName\} \$\{variantName\}`/);
  assert.match(waitlist, /normalizeSearch/);
});

test("restock dashboard keeps automatic refresh and limits heavy history rendering", () => {
  assert.match(waitlist, /ichigo:restock-processed/);
  assert.match(waitlist, /\.eq\("status", activeTab\)/);
  assert.match(waitlist, /\.limit\(500\)/);
  assert.match(waitlist, /Affichage des 500 alertes les plus récentes/);
});

test("V430 reuses V425 lifecycle columns without any new database schema", () => {
  assert.match(migration, /status text not null default 'active' check \(status in \('active','notified','cancelled'\)\)/);
  assert.match(migration, /notified_at timestamptz/);
  assert.match(migration, /cancelled_at timestamptz/);
});

test("V430 admin history is responsive and visually distinguishes its controls", () => {
  assert.match(css, /Ichigo Ichie V4\.30 — Restock admin history/);
  assert.match(css, /\.restock-admin-tabs-v430/);
  assert.match(css, /\.restock-admin-tools-v430/);
  assert.match(css, /\.restock-admin-dates-v430/);
  assert.match(css, /@media \(max-width:820px\)/);
});
