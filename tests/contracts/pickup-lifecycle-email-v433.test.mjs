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

test("V433 schema keeps historical pickup delivery markers without a destructive rollback", () => {
  for (const field of [
    "pickup_preparing_email_sent_at",
    "pickup_ready_email_sent_at",
    "pickup_completed_email_sent_at",
  ]) {
    assert.match(migration, new RegExp(`add column if not exists ${field} timestamptz`));
  }
});

test("active pickup lifecycle emails reuse the shared idempotent order email pipeline", () => {
  for (const kind of ["pickup_ready", "pickup_completed"]) {
    assert.ok(email.includes(`"${kind}"`), `missing email kind ${kind}`);
  }
  assert.doesNotMatch(email, /kind === "pickup_preparing"/);
  assert.match(email, /order\[timestampField\] && !options\.force/);
  assert.match(email, /Idempotency-Key/);
});

test("confirmation now tells pickup customers that preparation happens before a ready email", () => {
  assert.match(email, /Notre équipe va maintenant préparer votre commande/);
  assert.match(email, /Nous vous enverrons un nouvel e-mail dès qu’elle sera prête à être retirée en boutique/);
  assert.match(email, /Merci d’attendre cette confirmation avant de vous déplacer/);
});

test("ready pickup email contains pickup QR guidance, address and configured opening hours", () => {
  assert.match(email, /\["brand_name", "support_email", "store_address", "opening_hours"\]/);
  assert.match(email, /Votre commande est prête à retirer/);
  assert.match(email, /Vous pouvez venir récupérer votre commande/);
  assert.match(email, /Horaires d’ouverture/);
  assert.match(email, /settings\.opening_hours/);
  assert.match(email, /settings\.store_address/);
  assert.match(email, /QR de retrait/);
  assert.match(email, /reste disponible en secours/);
});

test("completed pickup email confirms handoff and points to the order where invoice is available", () => {
  assert.match(email, /Merci et à bientôt/);
  assert.match(email, /a bien été remise/);
  assert.match(email, /Votre facture est disponible dans le suivi de votre commande/);
  assert.match(email, /href="\$\{escapeHtml\(trackingPage\)\}"/);
  assert.match(email, />Voir ma commande<\/a>/);
});

test("automatic pickup emails run only for ready and completed after the status update succeeds", () => {
  const updateIndex = api.indexOf(
    'const { error: updateError } = await supabase.from("orders").update(patch)',
  );
  const pickupIndex = api.indexOf(
    'if (order.order_type === "pickup" && status && status !== order.status)',
  );
  assert.notEqual(updateIndex, -1, "order update contract missing");
  assert.notEqual(pickupIndex, -1, "pickup email contract missing");
  assert.ok(updateIndex < pickupIndex, "pickup email must happen after order update");
  assert.match(api, /status === "ready"\s*\? "pickup_ready"/);
  assert.match(api, /status === "completed"\s*\? "pickup_completed"/);
  assert.doesNotMatch(api, /status === "preparing"\s*\? "pickup_preparing"/);
});

test("pickup email delivery failure never rolls back the saved order status", () => {
  assert.match(api, /pickupEmail = "failed"/);
  assert.match(api, /Pickup lifecycle email error/);
  assert.match(api, /return NextResponse\.json\(\{ ok: true, shippingEmail, pickupEmail \}\)/);
  assert.match(admin, /pickupLifecycleEmailMessage\(status, data\.pickupEmail\)/);
});

test("admin can audit and manually resend ready and completed pickup emails only", () => {
  assert.match(api, /emailKind\.startsWith\("pickup_"\)/);
  assert.match(api, /pickup_ready: \["ready", "completed"\]/);
  assert.match(api, /pickup_completed: \["completed"\]/);
  assert.doesNotMatch(api, /pickup_preparing: \[/);
  assert.match(admin, /orderEmailAction\(order, "pickup_ready"\)/);
  assert.match(admin, /orderEmailAction\(order, "pickup_completed"\)/);
  assert.doesNotMatch(admin, /orderEmailAction\(order, "pickup_preparing"\)/);
  assert.match(admin, /Prête au retrait/);
});
