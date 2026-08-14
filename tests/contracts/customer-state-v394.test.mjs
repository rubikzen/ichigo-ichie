import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const account = readFileSync(resolve(root, "src/components/CustomerAccount.tsx"), "utf8");

test("checkout creates a stable idempotency reference at submit time", () => {
  assert.match(checkout, /useRef/);
  assert.match(checkout, /clientReferenceRef = useRef<string \| null>\(null\)/);
  assert.match(checkout, /clientReferenceRef\.current \?\? window\.crypto\.randomUUID\(\)/);
  assert.doesNotMatch(checkout, /setClientReference/);
  assert.doesNotMatch(checkout, /!clientReference \|\| !acceptedTerms/);
});

test("customer order fallback is derived instead of set inside an effect", () => {
  assert.match(account, /const effectiveOrderFilter: OrderFilter/);
  assert.match(account, /orderStats\.payment > 0 \? "payment" : "all"/);
  assert.doesNotMatch(account, /if \(orderFilter === "active" && orderStats\.active === 0\) \{/);
});

test("customer order UI uses the effective filter", () => {
  assert.match(account, /aria-selected=\{effectiveOrderFilter === value\}/);
  assert.match(account, /orderBucket\(order\) === effectiveOrderFilter/);
});
