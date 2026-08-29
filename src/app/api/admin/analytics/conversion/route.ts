import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const PERIODS = new Set([7, 30, 90]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EventRow = {
  event: "product_view" | "add_to_cart" | "begin_checkout" | "purchase";
  session_id: string;
  occurred_at: string;
  product_id: string | null;
  value: number | string | null;
};

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const requested = Number(url.searchParams.get("days") || 30);
    const days = PERIODS.has(requested) ? requested : 30;
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const { data, error } = await supabase
      .from("conversion_events")
      .select("event,session_id,occurred_at,product_id,value")
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true })
      .limit(10_000);

    if (error) {
      return NextResponse.json(
        {
          error: "Analytics indisponibles. Vérifiez la migration V464.",
          code: "ANALYTICS_NOT_READY",
        },
        { status: 503, headers: { "cache-control": "no-store" } },
      );
    }

    const rows = (data ?? []) as EventRow[];
    const conversionRows = rows.filter(
      (row) =>
        row.event !== "product_view" ||
        Boolean(row.product_id && UUID_RE.test(row.product_id)),
    );
    const count = (event: EventRow["event"]) =>
      conversionRows.filter((row) => row.event === event).length;

    const views = count("product_view");
    const adds = count("add_to_cart");
    const checkouts = count("begin_checkout");
    const purchases = count("purchase");
    const revenue = conversionRows
      .filter((row) => row.event === "purchase")
      .reduce((sum, row) => sum + Math.max(0, Number(row.value || 0)), 0);
    const sessions = new Set(conversionRows.map((row) => row.session_id)).size;

    const productStats = new Map<
      string,
      { productId: string; views: number; adds: number }
    >();

    for (const row of conversionRows) {
      if (!row.product_id || !UUID_RE.test(row.product_id)) continue;
      if (row.event !== "product_view" && row.event !== "add_to_cart") continue;
      const current = productStats.get(row.product_id) ?? {
        productId: row.product_id,
        views: 0,
        adds: 0,
      };
      if (row.event === "product_view") current.views += 1;
      if (row.event === "add_to_cart") current.adds += 1;
      productStats.set(row.product_id, current);
    }

    const productIds = [...productStats.keys()].slice(0, 100);
    const names = new Map<string, string>();
    if (productIds.length) {
      const { data: products } = await supabase
        .from("products")
        .select("id,name_fr,name_en")
        .in("id", productIds);
      for (const product of products ?? []) {
        names.set(
          String(product.id),
          String(product.name_fr || product.name_en || "Produit"),
        );
      }
    }

    const topProducts = [...productStats.values()]
      .map((item) => ({
        ...item,
        name: names.get(item.productId) || "Produit",
        addRate: item.views ? (item.adds / item.views) * 100 : 0,
      }))
      .sort((a, b) => b.adds - a.adds || b.views - a.views)
      .slice(0, 10);

    return NextResponse.json(
      {
        periodDays: days,
        summary: {
          sessions,
          views,
          adds,
          checkouts,
          purchases,
          revenue,
          viewToPurchaseRate: views ? (purchases / views) * 100 : 0,
          checkoutToPurchaseRate: checkouts ? (purchases / checkouts) * 100 : 0,
        },
        funnel: [
          { event: "product_view", label: "Vues produit", count: views },
          { event: "add_to_cart", label: "Ajouts panier", count: adds },
          { event: "begin_checkout", label: "Checkouts", count: checkouts },
          { event: "purchase", label: "Achats", count: purchases },
        ],
        topProducts,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin conversion analytics error", error);
    return NextResponse.json(
      { error: "Analytics indisponibles." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
