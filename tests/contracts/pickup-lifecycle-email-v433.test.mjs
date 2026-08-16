import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const migration = src("supabase/migrations/20260816163000_pickup_lifecycle_emails.sql");
const email = src("src/lib/order-email.ts");
const api = src("src/app/api/admin/orders/[id]/route.ts");
const admin = src("src/components/admin/AdminOrders.tsx");

test("V433 stores durable pickup email delivery markers", () => {
  for (const field of [
    "pickup_preparing_email_sent_at",
    "pickup_ready_email_sent_at",
    "pickup_completed_email_sent_at",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${field} timestamptz`));
    assert.match(email, new RegExp(field));
    assert.match(admin, new RegExp(field));
  }
});

test("pickup lifecycle email kinds reuse the shared idempotent order email pipeline", () => {
  for (const kind of ["pickup_preparing", "pickup_ready", "pickup_completed"]) {
    assert.ok(email.includes(`"${kind}"`), `missing email kind ${kind}`);
  }
  assert.match(email, /order\[timestampField\] && !options\.force/);
  assert.match(email, /Idempotency-Key/);
});

test("preparing email tells the customer not to travel before the ready message", () => {
  assert.match(email, /Votre commande est en préparation/);
  assert.match(email, /Nous vous préviendrons dès qu’elle sera prête/);
  assert.match(email, /Inutile de vous déplacer avant notre prochain e-mail/);
});

test("ready pickup email contains invitation address and configured opening hours", () => {
  assert.match(email, /\["brand_name", "support_email", "store_address", "opening_hours"\]/);
  assert.match(email, /Votre commande est prête à retirer/);
  assert.match(email, /Vous pouvez venir récupérer votre commande/);
  assert.match(email, /Horaires d’ouverture/);
  assert.match(email, /settings\.opening_hours/);
  assert.match(email, /settings\.store_address/);
  assert.match(email, /Présentez simplement le numéro de commande/);
});

test("completed pickup email confirms handoff and thanks the customer", () => {
  assert.match(email, /Merci et à bientôt/);
  assert.match(email, /a bien été remise/);
  assert.match(email, /Merci d’avoir choisi/);
});

test("automatic pickup emails run only after the order status update succeeds", () => {
  const updateIndex = api.indexOf(
    'const { error: updateError } = await supabase.from("orders").update(patch)',
  );
  const pickupIndex = api.indexOf(
    'if (order.order_type === "pickup" && status && status !== order.status)',
  );
  assert.notEqual(updateIndex, -1, "order update contract missing");
  assert.notEqual(pickupIndex, -1, "pickup email contract missing");
  assert.ok(updateIndex < pickupIndex, "pickup email must happen after order update");
  assert.match(api, /status === "preparing"\s*\? "pickup_preparing"/);
  assert.match(api, /status === "ready"\s*\? "pickup_ready"/);
  assert.match(api, /status === "completed"\s*\? "pickup_completed"/);
});

test("pickup email delivery failure never rolls back the saved order status", () => {
  assert.match(api, /pickupEmail = "failed"/);
  assert.match(api, /Pickup lifecycle email error/);
  assert.match(api, /return NextResponse\.json\(\{ ok: true, shippingEmail, pickupEmail \}\)/);
  assert.match(admin, /pickupLifecycleEmailMessage\(status, data\.pickupEmail\)/);
});

test("admin can audit and manually resend every pickup lifecycle email at valid states", () => {
  assert.match(api, /emailKind\.startsWith\("pickup_"\)/);
  assert.match(api, /pickup_preparing: \["preparing", "ready", "completed"\]/);
  assert.match(api, /pickup_ready: \["ready", "completed"\]/);
  assert.match(api, /pickup_completed: \["completed"\]/);
  assert.match(admin, /orderEmailAction\(order, "pickup_preparing"\)/);
  assert.match(admin, /orderEmailAction\(order, "pickup_ready"\)/);
  assert.match(admin, /orderEmailAction\(order, "pickup_completed"\)/);
  assert.match(admin, /Prête au retrait/);
});
