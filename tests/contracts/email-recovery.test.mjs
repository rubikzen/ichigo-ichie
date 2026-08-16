import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const orderEmail = source("src/lib/order-email.ts");
const invoice = source("src/lib/invoice.ts");
const adminOrderApi = source("src/app/api/admin/orders/[id]/route.ts");
const adminInvoiceApi = source("src/app/api/admin/invoices/[orderId]/route.ts");
const adminUi = source("src/components/admin/AdminOrders.tsx");

test("manual order email recovery uses force mode with a deduplicating suffix", () => {
  assert.match(adminOrderApi, /emailKind/);
  assert.match(adminOrderApi, /force: true/);
  assert.match(adminOrderApi, /admin-\$\{Math\.floor\(Date\.now\(\) \/ 60_000\)\}/);
  assert.match(orderEmail, /options: \{ force\?: boolean; idempotencySuffix\?: string \}/);
  assert.match(orderEmail, /&& !options\.force/);
});

test("manual recovery is limited to valid lifecycle states", () => {
  assert.match(adminOrderApi, /EMAIL_KINDS = new Set\(\["confirmation", "shipping", "refund", "pickup_preparing", "pickup_ready", "pickup_completed"\]\)/);
  assert.match(adminOrderApi, /confirmation.*\["paid", "refunded"\]/s);
  assert.match(adminOrderApi, /emailKind === "shipping"/);
  assert.match(adminOrderApi, /order\.status !== "completed"/);
  assert.match(adminOrderApi, /!order\.tracking_number/);
  assert.match(adminOrderApi, /emailKind === "refund" && order\.payment_status !== "refunded"/);
});

test("invoice resend bypasses already-sent guard only for explicit force", () => {
  assert.match(invoice, /invoice\.email_sent_at && !options\.force/);
  assert.match(invoice, /options\.idempotencySuffix/);
  assert.match(adminInvoiceApi, /credit_note_email/);
  assert.match(adminInvoiceApi, /sendInvoiceDocumentEmail\(supabase, document, order, resendOptions\)/);
});

test("admin loads email timestamps for invoices and exposes recovery controls", () => {
  assert.match(adminUi, /invoices\(id,document_type,document_number,email_sent_at\)/);
  assert.match(adminUi, /confirmation_email_sent_at/);
  assert.match(adminUi, /shipping_email_sent_at/);
  assert.match(adminUi, /refund_email_sent_at/);
  assert.match(adminUi, /pickup_preparing_email_sent_at/);
  assert.match(adminUi, /pickup_ready_email_sent_at/);
  assert.match(adminUi, /pickup_completed_email_sent_at/);
  assert.match(adminUi, /order-email-recovery-v373/);
  assert.match(adminUi, /Suivi & renvoi/);
});

test("admin recovery covers confirmation pickup lifecycle invoice shipping refund and credit note", () => {
  for (const label of ["Confirmation", "Préparation", "Prête au retrait", "Retrait terminé", "Facture", "Expédition", "Remboursement", "Avoir"]) {
    assert.ok(adminUi.includes(label), `missing recovery row: ${label}`);
  }
  assert.match(adminUi, /orderEmailAction\(order, "confirmation"\)/);
  assert.match(adminUi, /orderEmailAction\(order, "shipping"\)/);
  assert.match(adminUi, /orderEmailAction\(order, "refund"\)/);
  assert.match(adminUi, /orderEmailAction\(order, "pickup_preparing"\)/);
  assert.match(adminUi, /orderEmailAction\(order, "pickup_ready"\)/);
  assert.match(adminUi, /orderEmailAction\(order, "pickup_completed"\)/);
  assert.match(adminUi, /invoiceAction\(order, "email"\)/);
  assert.match(adminUi, /invoiceAction\(order, "credit_note_email"\)/);
});
