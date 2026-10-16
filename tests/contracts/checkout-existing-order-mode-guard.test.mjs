import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const orders = readFileSync("src/app/api/orders/route.ts", "utf8");
const checkout = readFileSync("src/app/checkout/page.tsx", "utf8");

test("reused orders validate the persisted delivery method", () => {
  const reused = orders.indexOf("if (existingOrder) {");
  const validation = orders.indexOf("checkoutFulfilmentError(persistedMode, availableModes)", reused);
  const checkoutSession = orders.indexOf("createOrReuseStripeCheckout(supabase, existingOrder.id", reused);
  assert.ok(reused !== -1 && validation > reused && checkoutSession > validation);
  assert.ok(orders.includes("if (persistedMode !== orderType)"));
  assert.ok(orders.includes("mismatch.status = 409"));
});

test("changing delivery options resets the previous client reference", () => {
  assert.ok(checkout.includes('clientReferenceRef.current = null; setOrderType("shipping")'));
  assert.ok(checkout.includes('clientReferenceRef.current = null; setOrderType("pickup")'));
  assert.ok(checkout.includes("clientReferenceRef.current ?? window.crypto.randomUUID()"));
});
