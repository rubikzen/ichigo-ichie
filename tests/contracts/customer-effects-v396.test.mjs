import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const checkout = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
const account = readFileSync(resolve(root, "src/components/CustomerAccount.tsx"), "utf8");
const tracker = readFileSync(resolve(root, "src/components/OrderTracker.tsx"), "utf8");

test("checkout defers synchronous effect state resets with cancellation guards", () => {
  assert.match(checkout, /if \(!mustPickup\) return;[\s\S]*queueMicrotask/);
  assert.match(checkout, /setQuote\(null\);[\s\S]*setQuoteError\(""\);[\s\S]*setShippingMethodId\(""\)/);
  assert.match(checkout, /setAddressSuggestions\(\[\]\)/);
  assert.match(checkout, /setCitySuggestions\(\[\]\)/);
  assert.match(checkout, /setAppliedPromo\(null\);[\s\S]*setPromoError\(""\)/);
  assert.ok((checkout.match(/queueMicrotask/g) ?? []).length >= 5);
});

test("customer account loading is derived from Supabase availability", () => {
  assert.match(account, /useState\(\(\) => Boolean\(supabase\)\)/);
  assert.doesNotMatch(account, /if \(!supabase\) \{ setLoading\(false\); return; \}/);
});

test("customer auth URL state is deferred after mount", () => {
  assert.match(account, /queueMicrotask\(\(\) => \{/);
  assert.match(account, /params\.get\("reset_password"\) === "1"/);
  assert.match(account, /params\.get\("auth_error"\)/);
});

test("order tracker defers payment query state synchronization", () => {
  assert.match(tracker, /queueMicrotask\(\(\) => \{/);
  assert.match(tracker, /setAutoRetryRequested\(true\)/);
  assert.match(tracker, /setPaymentReturn\(state\)/);
  assert.match(tracker, /cancelled = true/);
});
