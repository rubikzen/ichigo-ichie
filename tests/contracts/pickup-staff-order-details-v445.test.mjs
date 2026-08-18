import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const scan = src("src/app/api/pickup-staff/scan/route.ts");
const scanner = src("src/components/PickupScanner.tsx");
const css = src("src/app/styles/globals-04.css");

test("V445 reveals customer name and ordered products only after staff auth and signed QR verification", () => {
  const authIndex = scan.indexOf("requirePickupStaff(request)");
  const qrIndex = scan.indexOf("verifyPickupQrPayload(body.qr)");
  const selectIndex = scan.indexOf('.from("orders")');

  assert.ok(authIndex >= 0);
  assert.ok(qrIndex > authIndex);
  assert.ok(selectIndex > qrIndex);
  assert.ok(scan.includes("customer_first_name,customer_last_name"));
  assert.ok(scan.includes("order_items(product_name,quantity,choices)"));
});

test("V445 never adds price contact invoice or full-list data to the pickup scanner response", () => {
  for (const forbidden of [
    "customer_email",
    "customer_phone",
    "subtotal",
    "shipping_fee",
    "unit_price",
    "line_total",
    "invoices",
    "billing",
    "promo_code",
  ]) {
    assert.equal(scan.includes(forbidden), false, `forbidden field: ${forbidden}`);
  }
});

test("cancelled and refunded pickup QR scans do not reveal customer or item details", () => {
  const start = scan.indexOf("const canRevealPickupDetails = [");
  const end = scan.indexOf("const customerName", start);
  assert.ok(start >= 0 && end > start);

  const gate = scan.slice(start, end);
  for (const allowed of [
    '"ready"',
    '"completed"',
    '"payment_required"',
    '"not_ready"',
  ]) {
    assert.ok(gate.includes(allowed), `missing allowed state: ${allowed}`);
  }

  for (const forbidden of [
    '"cancelled"',
    '"refunded"',
    '"unavailable"',
  ]) {
    assert.equal(gate.includes(forbidden), false, `unexpected reveal state: ${forbidden}`);
  }
});

test("staff scanner displays the customer's full name after a valid pickup scan", () => {
  assert.ok(scanner.includes("customerName?: string;"));
  assert.ok(scanner.includes("<span>CLIENT</span>"));
  assert.ok(scanner.includes("{scanResult.customerName}"));
});

test("staff scanner displays quantity product name and selected choices without prices", () => {
  assert.ok(scanner.includes("<span>ARTICLES À REMETTRE</span>"));
  assert.ok(scanner.includes("{item.quantity} × {item.name}"));
  assert.ok(scanner.includes('item.choices.join(" · ")'));

  for (const forbidden of [
    "item.price",
    "item.total",
    "unitPrice",
    "lineTotal",
  ]) {
    assert.equal(scanner.includes(forbidden), false, `forbidden UI field: ${forbidden}`);
  }
});

test("handoff completion preserves the scanned operational details on screen", () => {
  assert.ok(scanner.includes("customerName: scanResult.customerName"));
  assert.ok(scanner.includes("items: scanResult.items"));
});

test("V445 pickup details are compact and collapse to one column on mobile", () => {
  const v445Start = css.indexOf(
    "/* Ichigo Ichie V4.45 — Pickup staff order details */"
  );
  const v446Start = css.indexOf(
    "/* Ichigo Ichie V4.46 — Pickup staff workflow */",
    v445Start
  );

  assert.ok(v445Start >= 0);
  assert.ok(v446Start > v445Start);

  const v445Css = css.slice(v445Start, v446Start);
  assert.ok(v445Css.includes(".pickup-order-details-v445"));
  assert.ok(v445Css.includes("@media (max-width: 720px)"));
  assert.ok(v445Css.includes("grid-template-columns: 1fr"));
});
