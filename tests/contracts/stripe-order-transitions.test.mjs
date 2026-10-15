import test from "node:test";
import assert from "node:assert/strict";
import {
  PAYMENT_PENDING_SOURCE_STATES,
  PAYMENT_UNPAID_SOURCE_STATES,
} from "../../src/lib/stripe-order-transitions.ts";

test("delayed pending Checkout event cannot downgrade an already completed order", () => {
  assert.deepEqual([...PAYMENT_PENDING_SOURCE_STATES], ["unpaid", "pending"]);
  for (const terminal of ["paid", "refunded", "refund_pending", "refund_failed", "failed", "expired"]) {
    assert.equal(PAYMENT_PENDING_SOURCE_STATES.includes(terminal), false);
  }
});

test("async failure and expiration events cannot downgrade a paid or refunding order", () => {
  assert.deepEqual([...PAYMENT_UNPAID_SOURCE_STATES], ["unpaid", "pending", "failed", "expired"]);
  for (const protectedState of ["paid", "refunded", "refund_pending", "refund_failed"]) {
    assert.equal(PAYMENT_UNPAID_SOURCE_STATES.includes(protectedState), false);
  }
});
