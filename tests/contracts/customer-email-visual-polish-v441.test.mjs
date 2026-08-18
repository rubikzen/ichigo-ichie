import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const email = readFileSync(resolve(root, "src/lib/order-email.ts"), "utf8");

test("V441 confirmation totals use email-safe tables instead of flexbox rows", () => {
  assert.match(email, /function confirmationSummary\(order: any\)/);
  assert.match(email, /<table role="presentation" style="width:100%;border-collapse:collapse/);
  const confirmationStart = email.indexOf('if (kind === "confirmation")');
  const shippingStart = email.indexOf('} else if (kind === "shipping")');
  const confirmationBlock = email.slice(confirmationStart, shippingStart);
  assert.doesNotMatch(confirmationBlock, /display:flex/);
  assert.doesNotMatch(confirmationBlock, /justify-content:space-between/);
});

test("pickup confirmation summary says Retrait boutique and Offert without a Livraison label", () => {
  assert.match(email, /const fulfilmentLabel = pickup \? "Retrait boutique" : "Livraison"/);
  assert.match(email, /const fulfilmentValue = pickup\s*\?\s*"Offert"/);
  assert.doesNotMatch(email, /Offerte \/ retrait/);
});

test("shipping confirmation summary preserves paid shipping cost and zero-fee wording", () => {
  assert.match(email, /Number\(order\.shipping_fee \|\| 0\) > 0\s*\?\s*money\(order\.shipping_fee\)\s*:\s*"Offerte"/);
});

test("paid confirmation email shows a payment-confirmed badge only when payment is paid", () => {
  assert.match(email, /function confirmationPaymentBadge\(order: any\)/);
  assert.match(email, /if \(order\.payment_status !== "paid"\) return ""/);
  assert.match(email, /Paiement confirmé/);
  assert.match(email, /\$\{confirmationPaymentBadge\(order\)\}/);
});

test("confirmation CTA now uses Voir ma commande rather than shipment-oriented tracking wording", () => {
  const confirmationStart = email.indexOf('if (kind === "confirmation")');
  const shippingStart = email.indexOf('} else if (kind === "shipping")');
  const confirmationBlock = email.slice(confirmationStart, shippingStart);
  assert.match(confirmationBlock, />Voir ma commande<\/a>/);
  assert.doesNotMatch(confirmationBlock, />Suivre ma commande<\/a>/);
});

test("V441 keeps the V435 pickup preparation guidance intact", () => {
  assert.match(email, /Notre équipe va maintenant préparer votre commande\./);
  assert.match(email, /Nous vous enverrons un nouvel e-mail dès qu’elle sera prête à être retirée en boutique\./);
  assert.match(email, /Merci d’attendre cette confirmation avant de vous déplacer\./);
});

test("confirmation summary keeps promo and total values in separate right-aligned cells", () => {
  assert.match(email, /Code promo \$\{escapeHtml\(order\.promo_code \|\| ""\)\}/);
  assert.match(email, /text-align:right;color:#486a4b;font-weight:700/);
  assert.match(email, />Total<\/td>/);
  assert.match(email, /text-align:right;font-size:20px;font-weight:700/);
});

test("email shell is width-safe for mobile clients without redesigning lifecycle templates", () => {
  assert.match(email, /-webkit-text-size-adjust:100%/);
  assert.match(email, /width:100%;max-width:640px/);
  assert.match(email, /box-sizing:border-box/);
  assert.match(email, /kind === "pickup_ready"/);
  assert.match(email, /kind === "pickup_completed"/);
  assert.match(email, /kind === "shipping"/);
});
