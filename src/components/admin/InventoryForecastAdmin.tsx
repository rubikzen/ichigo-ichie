"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryForecastConfidence,
  InventoryForecastRow,
  InventoryForecastSignal,
} from "@/lib/inventory-forecast";

type ForecastData = {
  periodDays: 30 | 60 | 90;
  targetCoverageDays: number;
  generatedAt: string;
  environment: "test" | "live";
  summary: {
    stockUnits: number;
    out: number;
    urgent: number;
    order: number;
    watch: number;
    healthy: number;
    noSales: number;
    suggestedUnits: number;
  };
  rows: InventoryForecastRow[];
  diagnostics: {
    ordersAnalyzed: number;
    orderItemsAnalyzed: number;
    unmappedUnits: number;
  };
};

const PERIODS = [30, 60, 90] as const;

const SIGNAL_LABELS: Record<InventoryForecastSignal, string> = {
  out: "Rupture",
  urgent: "Urgent ≤ 7 j",
  order: "Commander ≤ 14 j",
  watch: "Surveiller ≤ 30 j",
  healthy: "Stable",
  no_sales: "Pas de ventes",
};

const CONFIDENCE_LABELS: Record<
  InventoryForecastConfidence,
  string
> = {
  low: "Données faibles",
  medium: "Données moyennes",
  high: "Données solides",
};

function number(value: number, digits = 0) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function coverage(value: number | null) {
  if (value === null) return "—";
  if (value <= 0) return "0 j";
  if (value >= 365) return "> 1 an";
  return `${number(value, value < 10 ? 1 : 0)} j`;
}

export function InventoryForecastAdmin({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Session admin expirée.");

        const response = await fetch(
          `/api/admin/inventory-forecast?days=${days}`,
          {
            headers: { authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        );
        const body = (await response.json()) as ForecastData & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            body.error || "Prévision de stock indisponible.",
          );
        }

        if (!cancelled) setData(body);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Prévision de stock indisponible.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [days, refreshKey, supabase]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");

    return (data?.rows ?? []).filter((row) => {
      const priority =
        row.signal === "out" ||
        row.signal === "urgent" ||
        row.signal === "order" ||
        row.signal === "watch";

      if (!showAll && !priority) return false;

      if (!query) return true;
      const haystack = `${row.productName ?? ""} ${row.name} ${
        row.sku ?? ""
      }`.toLocaleLowerCase("fr-FR");
      return haystack.includes(query);
    });
  }, [data, search, showAll]);

  return (
    <section
      className="inventory-forecast-v467"
      aria-label="Prévision de stock Boutique"
    >
      <div className="inventory-forecast-head-v467">
        <div>
          <p className="eyebrow">STOCK & RÉAPPRO</p>
          <h3>Prévision de stock</h3>
          <p className="muted">
            Calcul déterministe sur les ventes Boutique payées. Couverture =
            stock disponible ÷ vitesse de vente. Suggestion = quantité
            nécessaire pour retrouver 30 jours de couverture.
          </p>
        </div>

        <div className="inventory-forecast-actions-v467">
          <div
            className="inventory-forecast-periods-v467"
            aria-label="Période de ventes utilisée"
          >
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                className={days === period ? "active" : ""}
                onClick={() => setDays(period)}
              >
                {period} j
              </button>
            ))}
          </div>
          <button
            type="button"
            className="button ghost small"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            Actualiser
          </button>
        </div>
      </div>

      {loading && (
        <p className="muted">Calcul de la couverture de stock…</p>
      )}

      {!loading && error && (
        <div className="inventory-forecast-empty-v467">
          <strong>Prévision indisponible</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="inventory-forecast-kpis-v467">
            <article className={data.summary.out ? "alert" : ""}>
              <span>Ruptures</span>
              <strong>{number(data.summary.out)}</strong>
            </article>
            <article className={data.summary.urgent ? "alert" : ""}>
              <span>≤ 7 jours</span>
              <strong>{number(data.summary.urgent)}</strong>
            </article>
            <article>
              <span>≤ 14 jours</span>
              <strong>{number(data.summary.order)}</strong>
            </article>
            <article>
              <span>À surveiller</span>
              <strong>{number(data.summary.watch)}</strong>
            </article>
            <article>
              <span>Réappro conseillé</span>
              <strong>{number(data.summary.suggestedUnits)} u.</strong>
            </article>
          </div>

          <div className="inventory-forecast-toolbar-v467">
            <div className="inventory-forecast-view-v467">
              <button
                type="button"
                className={!showAll ? "active" : ""}
                onClick={() => setShowAll(false)}
              >
                Priorités
              </button>
              <button
                type="button"
                className={showAll ? "active" : ""}
                onClick={() => setShowAll(true)}
              >
                Tous les stocks
              </button>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Produit, format, SKU…"
              aria-label="Rechercher dans la prévision de stock"
            />
          </div>

          {visibleRows.length ? (
            <div className="inventory-forecast-table-v467">
              <div className="inventory-forecast-row-v467 header">
                <span>Produit / format</span>
                <span>Stock</span>
                <span>Ventes</span>
                <span>Vitesse</span>
                <span>Couverture</span>
                <span>À commander</span>
                <span>Signal</span>
              </div>

              {visibleRows.map((row) => (
                <div
                  className="inventory-forecast-row-v467"
                  key={`${row.kind}:${row.id}`}
                >
                  <div className="inventory-forecast-product-v467">
                    <strong>
                      {row.productName
                        ? `${row.productName} · ${row.name}`
                        : row.name}
                    </strong>
                    <small>
                      {row.sku ? `SKU ${row.sku} · ` : ""}
                      {CONFIDENCE_LABELS[row.confidence]}
                    </small>
                  </div>
                  <span data-label="Stock">
                    <strong>{number(row.stock)}</strong>
                  </span>
                  <span data-label={`Ventes ${data.periodDays} j`}>
                    {number(row.unitsSold)}
                  </span>
                  <span data-label="Vitesse">
                    {number(row.dailyRate, row.dailyRate < 1 ? 2 : 1)}
                    /j
                  </span>
                  <span data-label="Couverture">
                    {coverage(row.coverageDays)}
                  </span>
                  <span data-label="À commander">
                    <strong>
                      {row.suggestedOrder > 0
                        ? `${number(row.suggestedOrder)} u.`
                        : "—"}
                    </strong>
                  </span>
                  <span
                    className={`inventory-signal-v467 ${row.signal}`}
                    data-label="Signal"
                  >
                    {SIGNAL_LABELS[row.signal]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="inventory-forecast-empty-v467">
              <strong>
                {showAll
                  ? "Aucun stock ne correspond à la recherche."
                  : "Aucune priorité de réapprovisionnement."}
              </strong>
              <span>
                {showAll
                  ? "Modifiez la recherche pour afficher d’autres références."
                  : "Les références avec ventes disposent de plus de 30 jours de couverture."}
              </span>
            </div>
          )}

          <div className="inventory-forecast-foot-v467">
            <span>
              {data.diagnostics.ordersAnalyzed} commande(s) payée(s)
              analysée(s) sur {data.periodDays} jours
            </span>
            <span>
              Objectif : {data.targetCoverageDays} jours de couverture
            </span>
            {data.diagnostics.unmappedUnits > 0 && (
              <span>
                {number(data.diagnostics.unmappedUnits)} unité(s)
                historique(s) non attribuable(s) à un stock actif
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
