import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const email = src("src/lib/order-email.ts");
const stripe = src("src/lib/stripe.ts");
const ordersApi = src("src/app/api/orders/route.ts");
const adminApi = src("src/app/api/admin/orders/[id]/route.ts");
const admin = src("src/components/admin/AdminOrders.tsx");
const invoiceSettings = src("src/components/InvoiceSettingsAdmin.tsx");
const adminInvoiceApi = src("src/app/api/admin/invoices/[orderId]/route.ts");

test("V435 confirmation absorbs pickup preparation and wait-for-ready guidance", () => {
  assert.match(email, /Notre équipe va maintenant préparer votre commande/);
  assert.match(email, /Nous vous enverrons un nouvel e-mail dès qu’elle sera prête à être retirée en boutique/);
  assert.match(email, /Merci d’attendre cette confirmation avant de vous déplacer/);
  assert.match(email, /const pickupPreparationNotice = order\.order_type === "pickup"/);
});

test("preparing is an internal status and can no longer send or resend a customer email", () => {
  assert.doesNotMatch(email, /"pickup_preparing"/);
  assert.doesNotMatch(adminApi, /pickup_preparing/);
  assert.doesNotMatch(admin, /pickup_preparing/);
  assert.match(admin, /\["ready", "completed"\]\.includes\(status\)/);
});

test("ready and completed remain the two post-confirmation pickup customer emails", () => {
  assert.match(adminApi, /status === "ready"\s*\? "pickup_ready"/);
  assert.match(adminApi, /status === "completed"\s*\? "pickup_completed"/);
  assert.match(email, /Votre commande est prête à retirer/);
  assert.match(email, /Merci et à bientôt/);
});

test("Stripe payment confirmation issues an invoice silently instead of sending a separate invoice email", () => {
  assert.match(stripe, /import \{ ensureInvoiceForOrder \} from "@\/lib\/invoice"/);
  assert.match(stripe, /await ensureInvoiceForOrder\(supabase, orderId\)/);
  assert.doesNotMatch(stripe, /issueAndEmailInvoice/);
  assert.match(stripe, /invoice stays available in tracking/);
});

test("free orders and manually recorded pickup payments also issue invoices silently", () => {
  assert.match(ordersApi, /await ensureInvoiceForOrder\(supabase, order\.id\)/);
  assert.doesNotMatch(ordersApi, /issueAndEmailInvoice/);
  assert.match(adminApi, /await ensureInvoiceForOrder\(supabase, id\)/);
  assert.doesNotMatch(adminApi, /issueAndEmailInvoice/);
});

test("completed pickup email directs customers to tracking where the invoice remains available", () => {
  assert.match(email, /Votre facture est disponible dans le suivi de votre commande/);
  assert.match(email, /Vous pouvez la télécharger quand vous le souhaitez/);
  assert.match(email, /href="\$\{escapeHtml\(trackingPage\)\}"/);
  assert.match(email, />Voir ma commande<\/a>/);
});

test("admin still retains an explicit manual invoice resend escape hatch", () => {
  assert.match(adminInvoiceApi, /action === "email"/);
  assert.match(adminInvoiceApi, /sendInvoiceDocumentEmail\(supabase, document, order, resendOptions\)/);
  assert.match(admin, /invoiceAction\(order, "email"\)/);
  assert.match(admin, /emailActionLabel\(invoiceDoc\.email_sent_at\)/);
  assert.match(admin, /order-email-recovery-v373/);
});

test("invoice settings explain silent invoice availability and reserve auto-email for credit notes", () => {
  assert.match(invoiceSettings, /reste disponible dans le suivi de commande et l’espace client, sans e-mail de facture séparé/);
  assert.match(invoiceSettings, /Envoyer automatiquement l’avoir PDF après remboursement/);
  assert.doesNotMatch(invoiceSettings, /Envoyer automatiquement le PDF au client/);
});
