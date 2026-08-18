import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const migration = src("supabase/migrations/20260818135000_pickup_staff_qr.sql");
const auth = src("src/lib/admin-auth.ts");
const qr = src("src/lib/pickup-qr.ts");
const qrRoute = src("src/app/api/orders/[token]/pickup-qr/route.ts");
const scanRoute = src("src/app/api/pickup-staff/scan/route.ts");
const completeRoute = src("src/app/api/pickup-staff/complete/route.ts");
const scanner = src("src/components/PickupScanner.tsx");
const tracker = src("src/components/OrderTracker.tsx");
const email = src("src/lib/order-email.ts");
const layout = src("src/app/retrait/layout.tsx");
const env = src(".env.example");
const pkg = JSON.parse(src("package.json"));

test("V444 creates a scanner-only identity table separate from admins", () => {
  assert.match(migration, /create table if not exists public\.pickup_staff/);
  assert.match(migration, /references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /pickup staff read own row/);
  assert.doesNotMatch(migration, /alter table public\.admins add column role/);
});

test("existing admin authorization remains exclusive while pickup staff gets a separate helper", () => {
  assert.match(auth, /export async function requireAdmin/);
  assert.match(auth, /export async function requirePickupStaff/);
  assert.match(auth, /\.from\("admins"\)/);
  assert.match(auth, /\.from\("pickup_staff"\)/);
  assert.match(auth, /access: "pickup_staff"/);
});

test("pickup QR is HMAC-signed and never embeds the public order token", () => {
  assert.match(qr, /createHmac\("sha256"/);
  assert.match(qr, /timingSafeEqual/);
  assert.match(qr, /ichigo-pickup:/);
  assert.match(qr, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(qr, /public_token/);
});

test("customer QR endpoint accepts a public tracking token but encodes only the signed pickup payload", () => {
  assert.match(qrRoute, /\.eq\("public_token", token\)/);
  assert.match(qrRoute, /\.select\("id,order_type,status"\)/);
  assert.match(qrRoute, /createPickupQrPayload\(order\.id\)/);
  assert.match(qrRoute, /order\.order_type !== "pickup"/);
  assert.match(qrRoute, /Cache-Control/);
  assert.doesNotMatch(qrRoute, /order_items/);
});

test("scan API requires pickup-staff authorization and never exposes customer contact or accounting data", () => {
  assert.match(scanRoute, /requirePickupStaff\(request\)/);
  assert.match(scanRoute, /verifyPickupQrPayload\(body\.qr\)/);
  assert.match(scanRoute, /canHandoff: state === "ready"/);
  assert.doesNotMatch(scanRoute, /customer_email|customer_phone/);
  assert.doesNotMatch(scanRoute, /subtotal|shipping_fee|total|unit_price|line_total/);
  assert.doesNotMatch(scanRoute, /invoices|promo_code|tracking_number/);
});

test("scan state permits handoff only when pickup is ready and already paid", () => {
  assert.match(scanRoute, /order\.status !== "ready"/);
  assert.match(scanRoute, /order\.payment_status !== "paid"/);
  assert.match(scanRoute, /return "payment_required"/);
  assert.match(scanRoute, /return "ready"/);
});

test("handoff API rejects non-ready or unpaid orders and is race-safe", () => {
  assert.match(completeRoute, /order\.status !== "ready"/);
  assert.match(completeRoute, /order\.payment_status !== "paid"/);
  assert.match(completeRoute, /\.eq\("status", "ready"\)/);
  assert.match(completeRoute, /\.eq\("payment_status", "paid"\)/);
  assert.match(completeRoute, /\.update\(\{ status: "completed" \}\)/);
});

test("scanner handoff reuses the existing pickup-completed customer email", () => {
  assert.match(completeRoute, /sendOrderEmail\(/);
  assert.match(completeRoute, /"pickup_completed"/);
  assert.match(completeRoute, /Pickup staff completed email error/);
});

test("customer tracking exposes the QR only for ready pickup orders", () => {
  assert.match(tracker, /order\.order_type === "pickup"/);
  assert.match(tracker, /order\.status === "ready"/);
  assert.match(tracker, /\/api\/orders\/\$\{encodeURIComponent\(token\)\}\/pickup-qr/);
  assert.match(tracker, /Votre QR de retrait/);
});

test("pickup ready email now directs customers to the QR without removing order-number fallback", () => {
  assert.match(email, /QR de retrait/);
  assert.match(email, /reste disponible en secours/);
  assert.match(email, />Voir ma commande<\/a>/);
});

test("scanner UI keeps camera and keyboard-scanner fallback without exposing a searchable order catalogue", () => {
  assert.match(scanner, /BrowserQRCodeReader/);
  assert.match(scanner, /decodeFromVideoDevice/);
  assert.match(scanner, /Scanner USB \/ code QR/);
  assert.match(scanner, /Confirmer la remise/);
  assert.doesNotMatch(scanner, /customer_email|customer_phone|line_total|unit_price/);
  assert.doesNotMatch(scanner, /Liste des commandes|Rechercher une commande/);
});

test("staff route is private/noindex and dependencies are declared", () => {
  assert.match(layout, /index: false/);
  assert.match(layout, /follow: false/);
  assert.match(env, /PICKUP_QR_SECRET=/);
  assert.ok(pkg.dependencies?.["@zxing/browser"]);
  assert.ok(pkg.dependencies?.qrcode);
  assert.ok(pkg.devDependencies?.["@types/qrcode"]);
});
