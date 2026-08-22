import { settingEnabled } from "@/lib/settings";
import { getCachedSiteSettings } from "@/lib/settings-server";
import { createServiceSupabase } from "@/lib/supabase/admin";

const MAX_PUBLIC_REVIEWS = 100;
const MAX_SCHEMA_REVIEWS = 5;

export type ProductReviewSeoReview = {
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  createdAt: string;
};

export type ProductReviewSeoSnapshot = {
  count: number;
  average: number;
  reviews: ProductReviewSeoReview[];
};

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function validRating(value: unknown) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;
}

function schemaAuthorAllowed(value: string) {
  const normalized = value.trim().toLocaleLowerCase("fr");
  return (
    value.length >= 2 &&
    value.length < 100 &&
    normalized !== "client vérifié" &&
    normalized !== "verified customer"
  );
}

function schemaReviewLimit(value: string | undefined) {
  const requested = Number.parseInt(value || "6", 10) || 6;
  return Math.min(
    MAX_SCHEMA_REVIEWS,
    Math.max(1, Math.min(20, requested)),
  );
}

export async function getProductReviewSeoSnapshot(
  productId: string,
): Promise<ProductReviewSeoSnapshot | null> {
  try {
    const settings = await getCachedSiteSettings();

    if (
      !settingEnabled(settings.shop_reviews_enabled) ||
      !settingEnabled(settings.shop_reviews_show_rating)
    ) {
      return null;
    }

    const supabase = createServiceSupabase();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from("product_reviews")
      .select("rating,title,body,author_name,created_at")
      .eq("product_id", productId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(MAX_PUBLIC_REVIEWS);

    if (error) {
      console.warn(
        "Product review SEO lookup failed; omitting review schema",
        error.message,
      );
      return null;
    }

    const rows: ProductReviewSeoReview[] = [];

    for (const row of data ?? []) {
      const rating = validRating(row.rating);
      if (rating == null) continue;

      rows.push({
        rating,
        title: clean(row.title, 120) || null,
        body: clean(row.body, 2000),
        authorName: clean(row.author_name, 100),
        createdAt: clean(row.created_at, 64),
      });
    }

    if (!rows.length) return null;

    const average =
      Math.round(
        (rows.reduce((sum, row) => sum + row.rating, 0) / rows.length) *
          10,
      ) / 10;

    const reviews = rows
      .filter(
        (row) =>
          row.body.length >= 2 &&
          schemaAuthorAllowed(row.authorName) &&
          /^\d{4}-\d{2}-\d{2}/.test(row.createdAt),
      )
      .slice(0, schemaReviewLimit(settings.shop_reviews_initial_limit));

    return {
      count: rows.length,
      average,
      reviews,
    };
  } catch (error) {
    console.warn(
      "Product review SEO snapshot unavailable; product page remains valid",
      error,
    );
    return null;
  }
}
