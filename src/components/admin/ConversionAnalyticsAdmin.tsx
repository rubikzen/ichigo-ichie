"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type AnalyticsData = {
  periodDays: number;
  summary: {
    sessions: number;
    views: number;
    adds: number;
    checkouts: number;
    purchases: number;
    revenue: number;
    viewToPurchaseRate: number;
    checkoutToPurchaseRate: number;
  };
  funnel: Array<{ event: string; label: string; count: number }>;
  topProducts: Array<{
    productId: string;
    name: string;
    views: number;
    adds: number;
    addRate: number;
  }>;
};

const PERIODS = [7, 30, 90] as const;

function number(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function percent(value: number) {
  return `${value.toFixed(1).replace(".", ",")} %`;
}

export function ConversionAnalyticsAdmin({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error("Session admin expirée.");

        const response = await fetch(`/api/admin/analytics/conversion?days=${days}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as AnalyticsData & {
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Analytics indisponibles.");
        if (!cancelled) setData(body);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Analytics indisponibles.",
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

  return (
    <section className="conversion-analytics-v464" aria-label="Conversion Boutique">
      <div className="conversion-analytics-head-v464">
        <div>
          <p className="eyebrow">CONVERSION</p>
          <h3>Parcours Boutique</h3>
          <p className="muted">
            Données first-party sans identité client : vue → panier → checkout → achat.
          </p>
        </div>
        <div className="conversion-analytics-actions-v464">
          <div className="conversion-periods-v464" aria-label="Période analytics">
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

      {loading && <p className="muted">Chargement des conversions…</p>}
      {!loading && error && (
        <div className="conversion-analytics-empty-v464">
          <strong>Analytics non disponibles</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="conversion-kpis-v464">
            <article><span>Sessions</span><strong>{number(data.summary.sessions)}</strong></article>
            <article><span>Achats</span><strong>{number(data.summary.purchases)}</strong></article>
            <article><span>Conversion vue → achat</span><strong>{percent(data.summary.viewToPurchaseRate)}</strong></article>
            <article><span>Checkout → achat</span><strong>{percent(data.summary.checkoutToPurchaseRate)}</strong></article>
            <article><span>CA attribué</span><strong>{euro(data.summary.revenue)}</strong></article>
          </div>

          <div className="conversion-funnel-v464">
            {data.funnel.map((step, index) => {
              const previous = index === 0 ? step.count : data.funnel[index - 1]?.count || 0;
              const progression = previous ? (step.count / previous) * 100 : 0;
              return (
                <article key={step.event}>
                  <div><span>{step.label}</span><strong>{number(step.count)}</strong></div>
                  <div className="conversion-funnel-track-v464" aria-hidden="true">
                    <i style={{ width: `${Math.max(3, Math.min(100, progression))}%` }} />
                  </div>
                  {index > 0 && <small>{percent(progression)} de l’étape précédente</small>}
                </article>
              );
            })}
          </div>

          <div className="conversion-products-v464">
            <div>
              <h4>Produits qui déclenchent le panier</h4>
              <p className="muted">Classement basé sur les vues et ajouts panier, sans inventer d’attribution produit sur l’achat.</p>
            </div>
            {data.topProducts.length ? (
              <div className="conversion-products-table-v464">
                <div className="conversion-product-row-v464 header"><span>Produit</span><span>Vues</span><span>Panier</span><span>Taux</span></div>
                {data.topProducts.map((product) => (
                  <div className="conversion-product-row-v464" key={product.productId}>
                    <strong>{product.name}</strong>
                    <span>{number(product.views)}</span>
                    <span>{number(product.adds)}</span>
                    <span>{percent(product.addRate)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Pas encore assez de données produit sur cette période.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
