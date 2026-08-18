import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const admin = readFileSync(
  resolve(root, "src/components/admin/AdminOrders.tsx"),
  "utf8",
);
const css = readFileSync(
  resolve(root, "src/app/styles/globals-04.css"),
  "utf8",
);

test("V443 adds density hooks to the existing order detail instead of replacing its workflow", () => {
  assert.match(admin, /order-body order-body-density-v443/);
  assert.match(admin, /order-main order-main-density-v443/);
  assert.match(admin, /order-customer order-customer-density-v443/);
  assert.match(admin, /order-action-rail-v442 order-action-rail-density-v443/);
  assert.match(admin, /order-quick-action-v440/);
});

test("customer shipping and tracking information stay visible but receive compact hooks", () => {
  assert.match(admin, /order-shipping-box order-shipping-box-density-v443/);
  assert.match(admin, /tracking-compact-v249 tracking-compact-density-v443/);
  assert.match(admin, /customer_phone/);
  assert.match(admin, /customer_email/);
});

test("pickup timeline remains always visible and is only made denser", () => {
  assert.match(
    admin,
    /pickup-admin-timeline-v437 pickup-admin-timeline-density-v443/
  );
  assert.doesNotMatch(admin, /<details[^>]*pickup-admin-timeline/);
  assert.match(admin, /pickupTimeline\.map/);
});

test("lifecycle email attention is derived only from existing real delivery timestamps", () => {
  assert.match(admin, /const lifecycleEmailNeedsAttention =/);
  assert.match(admin, /order\.confirmation_email_sent_at/);
  assert.match(admin, /order\.shipping_email_sent_at/);
  assert.match(admin, /order\.refund_email_sent_at/);
  assert.match(admin, /order\.pickup_ready_email_sent_at/);
  assert.match(admin, /order\.pickup_completed_email_sent_at/);
  assert.doesNotMatch(admin, /email_attention_at/);
});

test("email recovery becomes a native disclosure and auto-opens only for lifecycle attention", () => {
  assert.match(admin, /<details[\s\S]*order-email-recovery-disclosure-v443/);
  assert.match(admin, /open=\{lifecycleEmailNeedsAttention\}/);
  assert.match(admin, /Un envoi est à vérifier/);
  assert.match(admin, /Suivi & renvoi à la demande/);
  assert.match(admin, /order-email-recovery-v373 order-email-recovery-density-v443/);
});

test("manual invoice resend remains available inside the preserved email recovery controls", () => {
  assert.match(admin, /invoiceAction\(order, "email"\)/);
  assert.match(admin, /emailActionLabel\(invoiceDoc\.email_sent_at\)/);
  assert.match(admin, /order-email-recovery-row-v373/);
});

test("order lines remain fully mapped and are never truncated for density", () => {
  assert.match(admin, /order-lines order-lines-density-v443/);
  assert.match(admin, /order\.order_items\?\.map/);
  assert.doesNotMatch(admin, /order\.order_items\?\.slice/);
});

test("V443 compacts email rows and action rail on desktop while preserving mobile touch targets", () => {
  assert.match(css, /Ichigo Ichie V4\.43 — Admin order detail density/);
  assert.match(
    css,
    /order-email-recovery-density-v443 \.order-email-recovery-list-v373[\s\S]*repeat\(2,minmax\(0,1fr\)\)/
  );
  assert.match(css, /order-action-rail-density-v443/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /min-height: 44px/);
});

test("V443 is presentation-only and preserves V437 V440 and V442 surfaces", () => {
  assert.match(admin, /pickup-admin-timeline-v437/);
  assert.match(admin, /order-quick-action-v440/);
  assert.match(admin, /order-action-rail-v442/);
  assert.doesNotMatch(admin, /detail_density_status/);
  assert.doesNotMatch(admin, /density_updated_at/);
});
