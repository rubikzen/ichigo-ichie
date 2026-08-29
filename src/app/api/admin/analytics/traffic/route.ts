import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const PERIODS = new Set([7, 30]);

type TrafficRow = {
  session_id: string;
  occurred_at: string;
  path: string;
};

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
      .select("session_id,occurred_at,path")
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
