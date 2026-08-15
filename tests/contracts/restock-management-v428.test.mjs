import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const helper = readFileSync(resolve(root, "src/lib/restock-subscription.ts"), "utf8");
const subscribe = readFileSync(resolve(root, "src/app/api/restock/subscribe/route.ts"), "utf8");
const unsubscribe = readFileSync(resolve(root, "src/app/api/restock/unsubscribe/route.ts"), "utf8");
const page = readFileSync(resolve(root, "src/app/restock/desinscription/page.tsx"), "utf8");
const client = readFileSync(resolve(root, "src/components/RestockUnsubscribeClient.tsx"), "utf8");
const e2e = readFileSync(resolve(root, "tests/e2e/restock-api.spec.ts"), "utf8");
const migration = readFileSync(resolve(root, "supabase/migrations/20260815184000_restock_waitlist.sql"), "utf8");

test("restock management links are HMAC-signed and timing-safe", () => {
  assert.match(helper, /createHmac\("sha256", restockSecret\(\)\)/);
  assert.match(helper, /timingSafeEqual\(expected, received\)/);
  assert.match(helper, /RESTOCK_UNSUBSCRIBE_SECRET/);
  assert.match(helper, /restock\/desinscription/);
});

test("new waitlist registrations receive a bilingual management confirmation without coupling signup to email delivery", () => {
  assert.match(subscribe, /sendRestockSubscriptionConfirmation/);
  assert.match(subscribe, /Restock confirmation email error/);
  assert.match(helper, /Alerte enregistrée pour/);
  assert.match(helper, /Restock alert saved for/);
  assert.match(helper, /restock-confirmation-\$\{input\.subscriptionId\}/);
});

test("public unsubscribe is rate-limited signed and preserves notified history", () => {
  assert.match(unsubscribe, /scope: "restock:unsubscribe"/);
  assert.match(unsubscribe, /verifyRestockManageToken\(subscriptionId, token\)/);
  assert.match(unsubscribe, /subscription\.status === "notified"/);
  assert.match(unsubscribe, /status: "cancelled"/);
  assert.match(unsubscribe, /cancelled_at: cancelledAt/);
  assert.match(unsubscribe, /\.eq\("status", "active"\)/);
});

test("management page never cancels from GET and requires an explicit customer action", () => {
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(client, /onClick=\{\(\) => void cancelAlert\(\)\}/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /Annuler cette alerte/);
  assert.match(client, /Cancel this alert/);
  assert.doesNotMatch(page, /fetch\(/);
});

test("V428 reuses cancellation fields already created in V425 without a schema change", () => {
  assert.match(migration, /cancelled_at timestamptz/);
  assert.match(migration, /notified_at timestamptz/);
  assert.match(migration, /'cancelled'/);
});

test("V428 E2E coverage stays non-mutating", () => {
  assert.match(e2e, /RESTOCK_UNSUBSCRIBE_INVALID/);
  assert.match(e2e, /restock alert management page loads without mutating the alert/);
  assert.match(e2e, /Gérer votre alerte/);
});
