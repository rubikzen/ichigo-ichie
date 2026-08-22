import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { settingEnabled, siteSettingDefaults } from "@/lib/settings";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ productId: string }> },
) {
  const { productId } = await context.params;

  if (!UUID_RE.test(productId)) {
    return NextResponse.json(
      { error: "Produit invalide.", code: "REVIEW_PRODUCT_INVALID" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: "Service indisponible." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { data: enabledRow, error: enabledError } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "shop_reviews_enabled")
    .maybeSingle();

  if (enabledError) {
    console.warn("Review visibility lookup failed; using default", enabledError.message);
  }

  const reviewsEnabled = settingEnabled(
    enabledRow?.value == null
      ? siteSettingDefaults.shop_reviews_enabled
      : String(enabledRow.value),
  );

  if (!reviewsEnabled) {
    return NextResponse.json(
      {
        disabled: true,
        count: 0,
        average: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviews: [],
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  }

  const { data, error } = await supabase
    .from("product_reviews")
    .select(
      "id,rating,title,body,author_name,admin_reply,admin_replied_at,created_at",
    )
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Approved product review lookup failed", error);
    return NextResponse.json(
      { error: "Avis indisponibles." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rows = data ?? [];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const row of rows) {
    const rating = Number(row.rating);
    if (rating >= 1 && rating <= 5) {
      distribution[rating as keyof typeof distribution] += 1;
    }
  }

  const average = rows.length
    ? Math.round(
        (rows.reduce((sum, row) => sum + Number(row.rating), 0) /
          rows.length) *
          10,
      ) / 10
    : 0;

  return NextResponse.json(
    {
      count: rows.length,
      average,
      distribution,
      reviews: rows.map((row) => ({
        id: String(row.id),
        rating: Number(row.rating),
        title: row.title ? String(row.title) : null,
        body: String(row.body || ""),
        authorName: String(row.author_name || "Client vérifié"),
        createdAt: String(row.created_at),
        adminReply: row.admin_reply ? String(row.admin_reply) : null,
        adminRepliedAt: row.admin_replied_at
          ? String(row.admin_replied_at)
          : null,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
