import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const root = process.cwd();
const src = (path) => readFileSync(resolve(root, path), "utf8");

const seo = src("src/lib/product-review-seo.ts");
const productRoute = src("src/app/boutique/[slug]/page.tsx");
const publicRoute = src(
  "src/app/api/reviews/product/[productId]/route.ts",
);
const submitRoute = src("src/app/api/reviews/submit/route.ts");
const reviewsUi = src("src/components/ProductReviews.tsx");
const settings = src("src/lib/settings.ts");

test("V474 reads review schema data server-side from the private review table only", () => {
  assert.match(seo, /createServiceSupabase/);
  assert.match(seo, /\.from\("product_reviews"\)/);
  assert.match(seo, /\.eq\("product_id", productId\)/);
  assert.match(seo, /\.eq\("status", "approved"\)/);
  assert.doesNotMatch(
    seo,
    /order_id|order_item_id|public_token|customer_email|customer_phone/,
  );
});

test("V474 review schema obeys the same global review and rating visibility switches as storefront UI", () => {
  assert.match(seo, /settings\.shop_reviews_enabled/);
  assert.match(seo, /settings\.shop_reviews_show_rating/);
  assert.match(seo, /settingEnabled/);
  assert.match(reviewsUi, /settings\.shop_reviews_enabled/);
  assert.match(reviewsUi, /settings\.shop_reviews_show_rating/);
  assert.match(settings, /shop_reviews_enabled: "true"/);
  assert.match(settings, /shop_reviews_show_rating: "true"/);
});

test("V474 mirrors the existing public review feed approval ordering and 100-review bound", () => {
  assert.match(seo, /MAX_PUBLIC_REVIEWS = 100/);
  assert.match(seo, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(seo, /\.limit\(MAX_PUBLIC_REVIEWS\)/);
  assert.match(publicRoute, /\.eq\("status", "approved"\)/);
  assert.match(publicRoute, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(publicRoute, /\.limit\(100\)/);
});

test("V474 derives AggregateRating only from valid approved ratings and omits it when no visible ratings exist", () => {
  assert.match(seo, /validRating/);
  assert.match(seo, /if \(!rows\.length\) return null/);
  assert.match(productRoute, /"@type": "AggregateRating"/);
  assert.match(productRoute, /ratingValue: reviewSeo\.average/);
  assert.match(productRoute, /ratingCount: reviewSeo\.count/);
  assert.match(productRoute, /reviewCount: reviewSeo\.count/);
  assert.match(productRoute, /bestRating: 5/);
  assert.match(productRoute, /worstRating: 1/);
});

test("V474 nests individual Review markup directly in the existing specific Product entity", () => {
  assert.match(productRoute, /"@type": "Product"/);
  assert.match(productRoute, /review: reviewSeo\.reviews\.map/);
  assert.match(productRoute, /"@type": "Review"/);
  assert.match(productRoute, /"@type": "Rating"/);
  assert.match(productRoute, /"@type": "Person"/);
  assert.match(productRoute, /datePublished: review\.createdAt\.slice\(0, 10\)/);
});

test("V474 limits individual schema reviews to reviews immediately available in the storefront initial review window", () => {
  assert.match(seo, /MAX_SCHEMA_REVIEWS = 5/);
  assert.match(seo, /settings\.shop_reviews_initial_limit/);
  assert.match(seo, /Math\.min\(\s*MAX_SCHEMA_REVIEWS/);
  assert.match(reviewsUi, /settings\.shop_reviews_initial_limit/);
  assert.match(reviewsUi, /visibleReviews = reviews\.slice\(0, visibleCount\)/);
});

test("V474 excludes generic fallback authors from individual Review schema while preserving aggregate ratings", () => {
  assert.match(seo, /schemaAuthorAllowed/);
  assert.match(seo, /client vérifié/);
  assert.match(seo, /verified customer/);
  assert.match(seo, /value\.length < 100/);
  assert.match(seo, /\.filter\(/);
  assert.match(seo, /schemaAuthorAllowed\(row\.authorName\)/);
});

test("V474 individual review schema contains only the already-public review fields and never merchant replies", () => {
  assert.match(
    seo,
    /\.select\("rating,title,body,author_name,created_at"\)/,
  );
  assert.match(productRoute, /reviewBody: review\.body/);
  assert.match(productRoute, /name: review\.authorName/);
  assert.doesNotMatch(
    seo,
    /admin_reply|admin_replied_at|order_id|order_item_id/,
  );
  assert.doesNotMatch(productRoute, /adminReply|admin_reply/);
});

test("V474 preserves V466 verified-purchase truth rather than inventing a schema-only verified flag", () => {
  assert.match(submitRoute, /order\.payment_status !== "paid"/);
  assert.match(submitRoute, /order\.status !== "completed"/);
  assert.match(
    submitRoute,
    /String\(item\.product_id \|\| ""\) === productId/,
  );
  assert.doesNotMatch(productRoute, /verifiedPurchase|isVerifiedPurchase/);
  assert.doesNotMatch(seo, /verifiedPurchase|isVerifiedPurchase/);
});

test("V474 review SEO failure is non-blocking and changes no commerce schema or database state", () => {
  const combined = [seo, productRoute].join("\n");
  assert.match(seo, /return null/);
  assert.match(
    seo,
    /product page remains valid/,
  );
  assert.match(productRoute, /offers: productOffers\(product\)/);
  assert.match(productRoute, /data-product-schema-v431/);
  assert.match(productRoute, /data-product-review-schema-v474/);
  assert.doesNotMatch(combined, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.doesNotMatch(combined, /from\("orders"\)|from\("order_items"\)/);
});
