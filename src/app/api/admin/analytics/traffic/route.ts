import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const PERIODS = new Set([7, 30]);

type TrafficRow = {
  session_id: string;
  occurred_at: string;
  path: string;
  variant_id: string | null;
  transaction_ref: string | null;
};

type ProductClickRow = {
  session_id: string;
  product_id: string | null;
};

type GeoBucket = {
  sessions: Set<string>;
  pageviews: number;
};

function addGeoBucket(map: Map<string, GeoBucket>, key: string, sessionId: string) {
  const bucket = map.get(key) ?? { sessions: new Set<string>(), pageviews: 0 };
  bucket.sessions.add(sessionId);
  bucket.pageviews += 1;
  map.set(key, bucket);
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const requestUrl = new URL(request.url);
    const requestedDays = Number(requestUrl.searchParams.get("days") || 30);
    const days = PERIODS.has(requestedDays) ? requestedDays : 30;
    const until = new Date();
    const since = new Date(until.getTime() - days * 86_400_000);

    const { data, error } = await supabase
      .from("conversion_events")
      .select("session_id,occurred_at,path,variant_id,transaction_ref")
      .eq("event", "product_view")
      .is("product_id", null)
      .like("session_id", "traffic-%")
      .gte("occurred_at", since.toISOString())
      .order("occurred_at", { ascending: true })
      .limit(20_000);

    if (error) {
      return NextResponse.json(
        {
          available: false,
          periodDays: days,
          code: "TRAFFIC_STORAGE_UNAVAILABLE",
          message:
            "Le stockage analytics first-party n’est pas disponible pour le moment.",
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    const rows = (data ?? []) as TrafficRow[];
    const pageviews = rows.length;
    const visits = new Set(rows.map((row) => row.session_id)).size;

    const countryBuckets = new Map<string, GeoBucket>();
    const cityBuckets = new Map<string, GeoBucket>();

    for (const row of rows) {
      const countryCode = row.variant_id?.startsWith("geo:")
        ? row.variant_id.slice(4).toUpperCase()
        : "";
      if (/^[A-Z]{2}$/.test(countryCode)) {
        addGeoBucket(countryBuckets, countryCode, row.session_id);
      }

      const city = String(row.transaction_ref || "").trim();
      if (city) {
        addGeoBucket(cityBuckets, `${countryCode || "??"}|${city}`, row.session_id);
      }
    }

    const topCountries = [...countryBuckets.entries()]
      .map(([countryCode, bucket]) => ({
        countryCode,
        visits: bucket.sessions.size,
        pageviews: bucket.pageviews,
        share: visits > 0 ? (bucket.sessions.size / visits) * 100 : 0,
      }))
      .sort((a, b) => b.visits - a.visits || b.pageviews - a.pageviews)
      .slice(0, 10);

    const topCities = [...cityBuckets.entries()]
      .map(([key, bucket]) => {
        const separator = key.indexOf("|");
        return {
          countryCode: key.slice(0, separator),
          city: key.slice(separator + 1),
          visits: bucket.sessions.size,
          pageviews: bucket.pageviews,
        };
      })
      .sort((a, b) => b.visits - a.visits || b.pageviews - a.pageviews)
      .slice(0, 10);

    const { data: clickData, error: clickError } = await supabase
      .from("conversion_events")
      .select("session_id,product_id")
      .eq("event", "product_view")
      .eq("source", "product_modal")
      .not("product_id", "is", null)
      .gte("occurred_at", since.toISOString())
      .limit(20_000);

    if (clickError) {
      console.warn("Admin product click analytics unavailable", clickError.message);
    }

    const clickRows = (clickError ? [] : clickData ?? []) as ProductClickRow[];
    const clickBuckets = new Map<
      string,
      { clicks: number; sessions: Set<string> }
    >();

    for (const row of clickRows) {
      const productId = String(row.product_id || "").trim();
      if (!productId) continue;
      const bucket = clickBuckets.get(productId) ?? {
        clicks: 0,
        sessions: new Set<string>(),
      };
      bucket.clicks += 1;
      bucket.sessions.add(row.session_id);
      clickBuckets.set(productId, bucket);
    }

    const productIds = [...clickBuckets.keys()].slice(0, 100);
    const productNames = new Map<string, string>();
    if (productIds.length) {
      const { data: products } = await supabase
        .from("products")
        .select("id,name_fr,name_en")
        .in("id", productIds);
      for (const product of products ?? []) {
        productNames.set(
          String(product.id),
          String(product.name_fr || product.name_en || "Produit"),
        );
      }
    }

    const totalProductClicks = clickRows.length;
    const topProductClicks = [...clickBuckets.entries()]
      .map(([productId, bucket]) => ({
        productId,
        name: productNames.get(productId) || "Produit",
        clicks: bucket.clicks,
        sessions: bucket.sessions.size,
        share:
          totalProductClicks > 0
            ? (bucket.clicks / totalProductClicks) * 100
            : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks || b.sessions - a.sessions)
      .slice(0, 10);

    return NextResponse.json(
      {
        available: true,
        source: "first_party",
        periodDays: days,
        since: since.toISOString(),
        until: until.toISOString(),
        visits,
        pageviews,
        pagesPerVisit: visits > 0 ? pageviews / visits : 0,
        geo: {
          topCountries,
          topCities,
        },
        productClicks: {
          total: totalProductClicks,
          topProducts: topProductClicks,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const status = Math.max(
      400,
      Math.min(599, Number((error as { status?: number })?.status || 500)),
    );
    if (status >= 500) {
      console.warn(
        "Admin traffic analytics unavailable",
        error instanceof Error ? error.message : String(error),
      );
    }
    return NextResponse.json(
      { error: "Statistiques de trafic indisponibles." },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
}
