import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20261016123500_cover_unindexed_foreign_keys.sql", "utf8");

test("cover all seven Supabase foreign-key findings", () => {
  const expected = [
    ["invoices", "original_invoice_id"],
    ["order_items", "order_id"],
    ["order_items", "product_id"],
    ["order_items", "variant_id"],
    ["product_option_groups", "option_group_id"],
    ["product_reviews", "order_item_id"],
    ["restock_subscriptions", "variant_id"],
  ];
  for (const [table, column] of expected) {
    assert.ok(sql.includes("on public." + table + " (" + column + ")"));
  }
  assert.equal(sql.split("create index if not exists").length - 1, expected.length);
});
