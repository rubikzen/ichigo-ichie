import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const migration = src("supabase/migrations/20260823180500_consumer_withdrawals_v484.sql");
const api = src("src/app/api/withdrawal/route.ts");
const page = src("src/app/retractation/page.tsx");
const client = src("src/components/WithdrawalPageClient.tsx");
const email = src("src/lib/withdrawal-email.ts");
const footer = src("src/components/SiteFooter.tsx");
const admin = src("src/components/admin/WithdrawalAdmin.tsx");
const today = src("src/components/admin/AdminToday.tsx");
const css = src("src/app/styles/globals-04.css");

test("V484 stores durable withdrawal declarations without mutating orders", () => {
  assert.ok(migration.includes("create table if not exists public.consumer_withdrawals"));
  assert.ok(migration.includes("submitted_at timestamptz not null default now()"));
  assert.ok(migration.includes("acknowledgement_sent_at timestamptz"));
  assert.ok(migration.includes("selected_items jsonb"));
  assert.ok(!migration.includes("update public.orders"));
});

test("V484 withdrawal table is private to public clients and readable by Ichigo admins", () => {
  assert.ok(migration.includes("enable row level security"));
  assert.ok(migration.includes("revoke all on table public.consumer_withdrawals from anon"));
  assert.ok(migration.includes("public.is_ichigo_admin()"));
});

test("V484 replaces only the exact CGV retraction-location placeholder", () => {
  assert.ok(migration.includes("terms_body_fr"));
  assert.ok(migration.includes("https://www.ichigoichiematcha.fr/retractation"));
  assert.ok(migration.includes("[À COMPLÉTER AVEC L’URL OU L’EMPLACEMENT EXACT AVANT MISE EN LIGNE]"));
  assert.ok(!migration.includes("Nom : [À COMPLÉTER]"));
});

test("V484 public page is noindex and exposes an unambiguous final confirmation", () => {
  assert.ok(page.includes('canonical: "/retractation"'));
  assert.ok(page.includes("robots: { index: false, follow: true }"));
  assert.ok(client.includes("Confirmer ma rétractation"));
  assert.ok(client.includes("confirmed"));
});

test("V484 public flow verifies order number plus purchase email before exposing items", () => {
  assert.ok(api.includes('.eq("order_number", orderNumber)'));
  assert.ok(api.includes('.eq("customer_email", email)'));
  assert.ok(api.includes("order_items(id,product_name,quantity)"));
  assert.ok(client.includes('action: "lookup"'));
});

test("V484 supports whole-order or partial-item withdrawal", () => {
  assert.ok(api.includes('"full" : "partial"'));
  assert.ok(client.includes("Toute la commande"));
  assert.ok(client.includes("selected"));
});

test("V484 public API is rate-limited, honeypotted and idempotent", () => {
  assert.ok(api.includes('scope: "withdrawal:lookup"'));
  assert.ok(api.includes('scope: "withdrawal:submit"'));
  assert.ok(api.includes("body.website"));
  assert.ok(api.includes("client_reference"));
  assert.ok(api.includes("duplicate: true"));
});

test("V484 acknowledgement contains reference, order, timestamp and declaration scope", () => {
  assert.ok(email.includes("Accusé de réception de votre rétractation"));
  assert.ok(email.includes("requestNumber"));
  assert.ok(email.includes("orderNumber"));
  assert.ok(email.includes("submittedAt"));
  assert.ok(email.includes("Portée"));
});

test("V484 reuses configured Resend infrastructure with idempotency keys", () => {
  assert.ok(email.includes("RESEND_API_KEY"));
  assert.ok(email.includes("EMAIL_FROM"));
  assert.ok(email.includes("Idempotency-Key"));
  assert.ok(email.includes("withdrawal-ack-"));
});

test("V484 never auto-cancels refunds or returns stock from withdrawal receipt", () => {
  const combined = [api, email, client].join("\n");
  for (const forbidden of [
    "release_shop_order_stock",
    "reserve_shop_order_stock",
    "stripe.refunds",
    "createRefund",
    'status: "cancelled"',
    'payment_status: "refunded"',
  ]) {
    assert.ok(!combined.includes(forbidden), `must not contain ${forbidden}`);
  }
});

test("V484 gives consumers a direct footer access point", () => {
  assert.ok(footer.includes('href="/retractation"'));
  assert.ok(footer.includes("Renoncer au contrat ici"));
});

test("V484 surfaces received declarations in admin without changing orders", () => {
  assert.ok(today.includes("WithdrawalAdmin"));
  assert.ok(admin.includes("data-withdrawal-admin-v484"));
  assert.ok(admin.includes('.from("consumer_withdrawals")'));
  assert.ok(admin.includes("Marquer vérifiée"));
  assert.ok(admin.includes("Marquer traitée"));
  assert.ok(!admin.includes('.from("orders")'));
});

test("V484 records acknowledgement delivery outcome separately from legal receipt", () => {
  assert.ok(api.includes("acknowledgement_sent_at"));
  assert.ok(api.includes("acknowledgement_error"));
  assert.ok(client.includes("Déclaration enregistrée"));
});

test("V484 adds dedicated responsive and printable presentation", () => {
  assert.ok(css.includes("V484 - Online withdrawal / retractation"));
  assert.ok(css.includes(".withdrawal-page-v484"));
  assert.ok(css.includes("@media print"));
});
