import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { readJsonBody } from "@/lib/public-api";
import { settingEnabled, siteSettingDefaults } from "@/lib/settings";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{ productIds?: unknown }>(request, 20_000);
    if (!Array.isArray(body.productIds)) {
      return NextResponse.json(
        { error: "Produits invalides.", code: "REVIEW_SUMMARY_INVALID" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const productIds = [
      ...new Set(
        body.productIds
          .slice(0, 120)
          .map((value) => String(value ?? "").trim())
          .filter((value) => UUID_RE.test(value)),
      ),
    ];

    if (!productIds.length) {
      return NextResponse.json(
        { summaries: {} },
        { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
      );
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ summaries: {} }, { headers: { "Cache-Control": "no-store" } });
    }

    const [
      { data: enabledRow, error: enabledError },
      { data: rows, error: reviewError },
    ] = await Promise.all([
      supabase.from("site_settings").select("value").eq("key", "shop_reviews_enabled").maybeSingle(),
      supabase
        .from("product_reviews")
        .select("product_id,rating")
        .in("product_id", productIds)
        .eq("status", "approved"),
    ]);

    if (enabledError) {
      console.warn("Review summary visibility lookup failed; using default", enabledError.message);
    }

    const enabled = settingEnabled(
      enabledRow?.value == null
        ? siteSettingDefaults.shop_reviews_enabled
        : String(enabledRow.value),
    );

    if (!enabled) {
      return NextResponse.json(
        { summaries: {} },
        { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
      );
    }

    if (reviewError) throw reviewError;

    const totals = new Map<string, { count: number; total: number }>();
    for (const row of rows ?? []) {
      const productId = String(row.product_id || "");
      const rating = Number(row.rating);
      if (!productIds.includes(productId) || rating < 1 || rating > 5) continue;
      const current = totals.get(productId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += rating;
      totals.set(productId, current);
    }

    const summaries = Object.fromEntries(
      [...totals.entries()].map(([productId, value]) => [
        productId,
        {
          count: value.count,
          average: Math.round((value.total / value.count) * 10) / 10,
        },
      ]),
    );

    return NextResponse.json(
      { summaries },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } },
    );
  } catch (error) {
    console.error("Review summary API failed", error);
    return NextResponse.json(
      { summaries: {} },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
