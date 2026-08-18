import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260819003500_security_advisor_hardening.sql"
  ),
  "utf8"
);

test("V448 persists invoice counter RLS and removes browser table privileges", () => {
  assert.ok(
    migration.includes(
      "alter table public.invoice_counters enable row level security"
    )
  );
  assert.ok(
    migration.includes(
      "on table public.invoice_counters\n  from anon, authenticated"
    )
  );
  assert.ok(migration.includes("to service_role"));
});

test("V448 fixes set_updated_at search path and blocks direct client execution", () => {
  assert.ok(
    migration.includes(
      "alter function public.set_updated_at()\n  set search_path = public"
    )
  );
  assert.ok(
    migration.includes(
      "on function public.set_updated_at()\n  from public, anon, authenticated"
    )
  );
});

test("admin helper functions use SECURITY INVOKER rather than SECURITY DEFINER", () => {
  const adminStart = migration.indexOf(
    "create or replace function public.is_admin()"
  );
  const duplicateStart = migration.indexOf(
    "create or replace function public.is_ichigo_admin()"
  );
  assert.ok(adminStart >= 0);
  assert.ok(duplicateStart > adminStart);

  const adminBlock = migration.slice(adminStart, duplicateStart);
  assert.ok(adminBlock.includes("security invoker"));
  assert.equal(adminBlock.includes("security definer"), false);

  const duplicateBlock = migration.slice(
    duplicateStart,
    migration.indexOf("-- Anonymous catalog reads", duplicateStart)
  );
  assert.ok(duplicateBlock.includes("security invoker"));
  assert.equal(duplicateBlock.includes("security definer"), false);
});

test("anonymous catalog policies no longer execute is_admin", () => {
  for (const name of [
    "public read active categories",
    "public read active products",
    "public read active variants",
    "public read active option values",
  ]) {
    const start = migration.indexOf(`create policy "${name}"`);
    assert.ok(start >= 0, `missing policy ${name}`);
    const block = migration.slice(start, migration.indexOf(";", start) + 1);
    assert.ok(block.includes("using (active)"));
    assert.equal(block.includes("is_admin"), false);
  }
});

test("authenticated admins retain read access to inactive catalog records", () => {
  for (const name of [
    "admins read all categories",
    "admins read all products",
    "admins read all variants",
    "admins read all option values",
  ]) {
    const start = migration.indexOf(`create policy "${name}"`);
    assert.ok(start >= 0, `missing policy ${name}`);
    const block = migration.slice(start, migration.indexOf(";", start) + 1);
    assert.ok(block.includes("to authenticated"));
    assert.ok(block.includes("using (public.is_admin())"));
  }
});

test("customer_owns_order becomes an authenticated SECURITY INVOKER helper", () => {
  const start = migration.indexOf(
    "create or replace function public.customer_owns_order"
  );
  const end = migration.indexOf(
    "-- claim_customer_orders() intentionally",
    start
  );
  const block = migration.slice(start, end);
  assert.ok(block.includes("security invoker"));
  assert.equal(block.includes("security definer"), false);
  assert.ok(
    block.includes(
      "on function public.customer_owns_order(uuid)\n  to authenticated"
    )
  );
});

test("guest-order claiming remains signed-in only and never anonymous", () => {
  assert.ok(
    migration.includes(
      "on function public.claim_customer_orders()\n  from public, anon"
    )
  );
  assert.ok(
    migration.includes(
      "on function public.claim_customer_orders()\n  to authenticated"
    )
  );
  assert.equal(
    migration.includes(
      "on function public.claim_customer_orders()\n  to anon"
    ),
    false
  );
});

test("V448 removes broad public Storage listing policies", () => {
  assert.ok(
    migration.includes(
      'drop policy if exists "public read product images" on storage.objects'
    )
  );
  assert.ok(
    migration.includes(
      'drop policy if exists "public read site media" on storage.objects'
    )
  );
});

test("Storage listing remains available only to authenticated admins", () => {
  for (const name of [
    "admins read product image objects",
    "admins read site media objects",
  ]) {
    const start = migration.indexOf(`create policy "${name}"`);
    assert.ok(start >= 0, `missing policy ${name}`);
    const block = migration.slice(start, migration.indexOf(";", start) + 1);
    assert.ok(block.includes("to authenticated"));
    assert.ok(block.includes("public.is_admin()"));
  }
});

test("V448 keeps product and site media buckets public for existing public URLs", () => {
  assert.ok(migration.includes("update storage.buckets"));
  assert.ok(migration.includes("set public = true"));
  assert.ok(migration.includes("'product-images', 'site-media'"));
});

test("direct execution of SECURITY DEFINER trigger functions is revoked", () => {
  assert.ok(migration.includes("p.prosecdef = true"));
  assert.ok(
    migration.includes(
      "p.prorettype = 'pg_catalog.trigger'::regtype"
    )
  );
  assert.ok(
    migration.includes(
      "revoke execute on function %s from public, anon, authenticated"
    )
  );
  assert.ok(
    migration.includes(
      "on function public.release_promo_before_order_delete()\n  from public, anon, authenticated"
    )
  );
  assert.ok(
    migration.includes(
      "on function public.sync_order_stock_on_status()\n  from public, anon, authenticated"
    )
  );
});

test("internal RLS tables stay deny-by-default without fake browser policies", () => {
  assert.equal(migration.includes("on public.invoice_counters"), false);
  assert.equal(migration.includes("on public.api_rate_limits"), false);
});
