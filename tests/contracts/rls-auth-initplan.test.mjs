import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20261016125500_optimize_rls_auth_initplan.sql", "utf8");

test("auth uid is wrapped in a per-statement scalar query", () => {
  const policies = [
    'admins can read own admin row',
    'pickup staff read own row',
    'promo_codes_admin_all',
  ];
  for (const name of policies) assert.ok(sql.includes('alter policy "' + name + '"'));
  assert.equal(sql.split("alter policy").length - 1, 3);
  assert.equal(sql.split("(select auth.uid())").length - 1, 4);
});

test("policy changes preserve admin and staff checks", () => {
  assert.ok(sql.includes("user_id = (select auth.uid())"));
  assert.ok(sql.includes("from public.admins a where a.user_id = (select auth.uid())"));
  assert.ok(sql.includes("with check"));
});
