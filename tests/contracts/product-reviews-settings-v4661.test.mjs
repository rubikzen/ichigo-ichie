import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");
const settings = src("src/lib/settings.ts");
const admin = src("src/components/admin/AdminSettings.tsx");
const submit = src("src/app/api/reviews/submit/route.ts");
const publicRoute = src("src/app/api/reviews/product/[productId]/route.ts");
const summary = src("src/app/api/reviews/summary/route.ts");
const provider = src("src/components/ReviewSummaryProvider.tsx");
const reviews = src("src/components/ProductReviews.tsx");
const orderReview = src("src/components/OrderReviewPanel.tsx");
const card = src("src/components/ProductCard.tsx");
const home = src("src/components/HomePageContent.tsx");
const catalog = src("src/components/CatalogGrid.tsx");
const css = src("src/app/styles/globals-04.css");

test("V466.1 adds review configuration to key-value CMS", () => {
  for (const key of [
    "shop_reviews_enabled",
    "shop_reviews_show_rating",
    "shop_reviews_moderation_mode",
    "shop_reviews_verified_badge_visible",
    "shop_reviews_admin_reply_visible",
    "shop_reviews_initial_limit",
    "shop_reviews_card_rating_visible",
  ]) {
    assert.ok(settings.includes(key));
    assert.ok(admin.includes(key));
  }
  assert.match(admin, /Validation manuelle/);
  assert.match(admin, /Publication automatique/);
  assert.match(admin, /max="20"/);
});

test("auto publication still follows verified purchase guards", () => {
  const mode = submit.indexOf("shop_reviews_moderation_mode");
  const paid = submit.indexOf('order.payment_status !== "paid"');
  const product = submit.indexOf('String(item.product_id || "") === productId');
  const insert = submit.lastIndexOf('.from("product_reviews")');
  assert.ok(mode >= 0 && paid > mode && product > paid && insert > product);
  assert.match(submit, /REVIEWS_DISABLED/);
  assert.match(submit, /status: reviewStatus/);
});

test("global visibility is enforced in public feed and order panel", () => {
  assert.match(publicRoute, /shop_reviews_enabled/);
  assert.match(publicRoute, /disabled: true/);
  assert.match(orderReview, /!reviewsEnabled/);
  assert.match(orderReview, /shop_reviews_verified_badge_visible/);
});

test("product review UI honors rating badge reply and initial limit", () => {
  assert.match(reviews, /shop_reviews_show_rating/);
  assert.match(reviews, /shop_reviews_verified_badge_visible/);
  assert.match(reviews, /shop_reviews_admin_reply_visible/);
  assert.match(reviews, /shop_reviews_initial_limit/);
  assert.match(reviews, /visibleReviews = reviews\.slice/);
  assert.match(reviews, /Voir plus d’avis/);
  assert.match(reviews, /id="avis"/);
});

test("batch summary uses approved ratings only without customer data", () => {
  assert.match(summary, /\.slice\(0, 120\)/);
  assert.match(summary, /\.select\("product_id,rating"\)/);
  assert.match(summary, /\.eq\("status", "approved"\)/);
  assert.doesNotMatch(summary, /customer_email|customer_phone|author_name|order_id/);
});

test("summary provider makes one batch request and obeys card toggles", () => {
  assert.match(provider, /fetch\("\/api\/reviews\/summary"/);
  assert.match(provider, /productIds: idsKey\.split/);
  assert.match(provider, /shop_reviews_enabled/);
  assert.match(provider, /shop_reviews_show_rating/);
  assert.match(provider, /shop_reviews_card_rating_visible/);
});

test("ProductCard displays aggregate rating without fetching itself", () => {
  assert.match(card, /useProductReviewSummary\(product\.id\)/);
  assert.match(card, /product-card-rating-v4661/);
  assert.match(card, /#avis/);
  assert.doesNotMatch(card, /fetch\("\/api\/reviews/);
});

test("home and dedicated shop use batch providers responsively", () => {
  assert.match(home, /ReviewSummaryProvider productIds=\{shopProducts\.map/);
  assert.match(catalog, /ReviewSummaryProvider productIds=\{products\.map/);
  assert.match(css, /V466\.1 — review settings and catalogue ratings/);
  assert.match(css, /@media \(max-width: 700px\)/);
});
