import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const PERIODS = new Set([7, 30]);
const DEFAULT_PROJECT_ID = "prj_XFGEhBxRHx4j8MrvKWi18MnPjbnR";
const DEFAULT_TEAM_ID = "team_x1tAIKgv9n1PAV51FYz3E9Q0";

type VercelCountPayload = {
  data?: {
    visitors?: number;
    pageviews?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function analyticsToken() {
  return (
    process.env.VERCEL_ANALYTICS_TOKEN?.trim() ||
    process.env.VERCEL_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const requestUrl = new URL(request.url);
    const requestedDays = Number(requestUrl.searchParams.get("days") || 30);
    const days = PERIODS.has(requestedDays) ? requestedDays : 30;
    const token = analyticsToken();

    if (!token) {
      return NextResponse.json(
        {
          configured: false,
          available: false,
          periodDays: days,
          code: "VERCEL_ANALYTICS_TOKEN_MISSING",
          message:
            "La collecte peut fonctionner, mais l’affichage dans l’admin nécessite VERCEL_ANALYTICS_TOKEN côté serveur.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const until = new Date();
    const since = new Date(until.getTime() - days * 86_400_000);
    const projectId =
      process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() ||
      process.env.VERCEL_PROJECT_ID?.trim() ||
      DEFAULT_PROJECT_ID;
    const teamId =
      process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || DEFAULT_TEAM_ID;

    const endpoint = new URL(
      "https://api.vercel.com/v1/query/web-analytics/visits/count",
    );
    endpoint.searchParams.set("projectId", projectId);
    endpoint.searchParams.set("teamId", teamId);
    endpoint.searchParams.set("since", since.toISOString());
    endpoint.searchParams.set("until", until.toISOString());

    const response = await fetch(endpoint, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      cache: "no-store",
    });

    let payload: VercelCountPayload = {};
    try {
      payload = (await response.json()) as VercelCountPayload;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          configured: true,
          available: false,
          periodDays: days,
          code: payload.error?.code || `VERCEL_ANALYTICS_${response.status}`,
          message:
            payload.error?.message ||
            "Vercel Web Analytics n’est pas encore disponible pour ce projet.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const visitors = Number(payload.data?.visitors);
    const pageviews = Number(payload.data?.pageviews);

    if (!Number.isFinite(visitors) || !Number.isFinite(pageviews)) {
      return NextResponse.json(
        {
          configured: true,
          available: false,
          periodDays: days,
          code: "VERCEL_ANALYTICS_EMPTY",
          message:
            "Aucune donnée de trafic n’est encore disponible. Les premières visites apparaîtront après l’activation de Web Analytics et le nouveau déploiement.",
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        configured: true,
        available: true,
        periodDays: days,
        since: since.toISOString(),
        until: until.toISOString(),
        visitors,
        pageviews,
        pagesPerVisitor: visitors > 0 ? pageviews / visitors : 0,
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
