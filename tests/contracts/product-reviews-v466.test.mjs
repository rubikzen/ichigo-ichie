import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const migration = src(
  "supabase/migrations/20260822134500_product_reviews_v466.sql",
);
const publicRoute = src(
  "src/app/api/reviews/product/[productId]/route.ts",
);
const submitRoute = src("src/app/api/reviews/submit/route.ts");
const adminRoute = src("src/app/api/admin/reviews/route.ts");
const productReviews = src("src/components/ProductReviews.tsx");
const orderReview = src("src/components/OrderReviewPanel.tsx");
const productPage = src("src/components/ProductPageContent.tsx");
const tracker = src("src/components/OrderTracker.tsx");
const orderRoute = src("src/app/api/orders/[token]/route.ts");
const adminReviews = src(
  "src/components/admin/ProductReviewsAdmin.tsx",
);
const adminOrders = src("src/components/admin/AdminOrders.tsx");
const css = src("src/app/styles/globals-04.css");

test("V466 stores reviews privately and binds one review to a purchased product per order", () => {
  assert.match(
    migration,
    /create table if not exists public\.product_reviews/,
  );
  assert.match(migration, /references public\.orders\(id\)/);
  assert.match(migration, /references public\.order_items\(id\)/);
  assert.match(migration, /product_reviews_order_product_uidx/);
  assert.match(migration, /enable row level security/);
  assert.match(
    migration,
    /revoke all on table public\.product_reviews from anon, authenticated/,
  );
  const schemaOnly = migration.replace(/^--.*$/gm, "");
  assert.doesNotMatch(schemaOnly, /\bemail\b|\bphone\b|\baddress\b/i);
});

test("V466 submission verifies a real paid completed order and purchased product server-side", () => {
  assert.match(submitRoute, /\.eq\("public_token", orderToken\)/);
  assert.match(submitRoute, /order\.payment_status !== "paid"/);
  assert.match(submitRoute, /order\.status !== "completed"/);
  assert.match(
    submitRoute,
    /String\(item\.product_id \|\| ""\) === productId/,
  );
  // V466.1 preserves verified-purchase guards while making publication
  // configurable: manual => pending, automatic => approved.
  assert.match(submitRoute, /const reviewStatus/);
  assert.match(submitRoute, /status: reviewStatus/);
  assert.doesNotMatch(
    submitRoute,
    /body\.verified|verified:\s*body|customer_email/,
  );
});

test("V466 submission is rate-limited bounded and derives a privacy-safe public author", () => {
  assert.match(submitRoute, /readJsonBody/);
  assert.match(submitRoute, /scope: "reviews:submit:v466"/);
  assert.match(submitRoute, /limit: 5/);
  assert.match(submitRoute, /publicAuthorName/);
  assert.match(submitRoute, /last\.slice\(0, 1\)/);
  assert.match(submitRoute, /REVIEW_ALREADY_SUBMITTED/);
});

test("V466 public review feed exposes approved review content only and no purchase references", () => {
  assert.match(publicRoute, /\.eq\("status", "approved"\)/);
  assert.match(publicRoute, /distribution/);
  assert.match(publicRoute, /average/);
  assert.doesNotMatch(
    publicRoute,
    /order_id|order_item_id|public_token|customer_email/,
  );
});

test("V466 product page renders verified review summary distribution sorting and admin replies", () => {
  assert.match(productPage, /<ProductReviews productId=\{product\.id\}/);
  assert.match(productReviews, /Achat vérifié/);
  assert.match(productReviews, /\[5, 4, 3, 2, 1\]/);
  assert.match(productReviews, /Meilleure note/);
  assert.match(productReviews, /Réponse de la maison/);
});

test("V466 order tracking is the verified guest review entry point after completion", () => {
  assert.match(tracker, /product_id\?: string \| null/);
  assert.match(tracker, /<OrderReviewPanel/);
  assert.match(tracker, /paymentStatus=\{order\.payment_status\}/);
  assert.match(orderReview, /paymentStatus !== "paid"/);
  assert.match(orderReview, /status !== "completed"/);
  assert.match(orderReview, /orderToken: token/);
  assert.match(orderRoute, /order_items[\s\S]*product_id/);
});

test("V466 moderation is admin-only with pending approved hidden states and replies", () => {
  assert.match(adminRoute, /requireAdmin\(request\)/);
  assert.match(
    adminRoute,
    /new Set\(\["pending", "approved", "hidden"\]\)/,
  );
  assert.match(adminRoute, /admin_reply/);
  assert.match(adminReviews, /Avis produits vérifiés/);
  assert.match(adminReviews, /Publier/);
  assert.match(adminReviews, /Masquer/);
  assert.match(adminReviews, /Enregistrer la réponse/);
});

test("V466 reuses Boutique pilotage and remains responsive without catalogue N plus one review requests", () => {
  assert.match(
    adminOrders,
    /<ProductReviewsAdmin supabase=\{supabase\} \/>/,
  );
  assert.match(css, /V466 — verified product reviews/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(
    src("src/components/ProductCard.tsx"),
    /\/api\/reviews\/product\//,
  );
});
