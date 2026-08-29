"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type TrafficData = {
  configured: boolean;
  available: boolean;
  periodDays: number;
  visitors?: number;
  pageviews?: number;
  pagesPerVisitor?: number;
  since?: string;
  until?: string;
  code?: string;
  message?: string;
  error?: string;
};

const PERIODS = [7, 30] as const;

function integer(value: number | undefined) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Number(value || 0)),
  );
}

function decimal(value: number | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0, Number(value || 0)));
}

export function TrafficAnalyticsAdmin({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [data, setData] = useState<TrafficData | null>(null);
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

        const response = await fetch(`/api/admin/analytics/traffic?days=${days}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as TrafficData;
        if (!response.ok) {
          throw new Error(body.error || "Statistiques de trafic indisponibles.");
        }
        if (!cancelled) setData(body);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Statistiques de trafic indisponibles.",
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
    <section className="conversion-analytics-v464" aria-label="Trafic du site">
      <div className="conversion-analytics-head-v464">
        <div>
          <p className="eyebrow">TRAFIC</p>
          <h3>Visites du site</h3>
          <p className="muted">
            Visiteurs et pages vues en production. L’administration et les API ne sont pas comptées.
          </p>
        </div>
        <div className="conversion-analytics-actions-v464">
          <div className="conversion-periods-v464" aria-label="Période trafic">
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

      {loading && <p className="muted">Chargement du trafic…</p>}

      {!loading && error && (
        <div className="conversion-analytics-empty-v464">
          <strong>Trafic indisponible</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && data && !data.available && (
        <div className="conversion-analytics-empty-v464">
          <strong>
            {data.configured ? "En attente des premières données" : "Connexion Vercel à terminer"}
          </strong>
          <span>{data.message || "Les statistiques ne sont pas encore disponibles."}</span>
          {!data.configured && (
            <small>
              Ajoutez VERCEL_ANALYTICS_TOKEN dans les variables serveur du projet Vercel. Le token n’est jamais envoyé au navigateur.
            </small>
          )}
          {data.configured && data.code === "VERCEL_ANALYTICS_EMPTY" && (
            <small>
              Dans Vercel, ouvrez le projet Ichigo Ichie → Analytics et vérifiez que Web Analytics est activé.
            </small>
          )}
        </div>
      )}

      {!loading && data?.available && (
        <>
          <div className="conversion-kpis-v464">
            <article>
              <span>Visiteurs</span>
              <strong>{integer(data.visitors)}</strong>
            </article>
            <article>
              <span>Pages vues</span>
              <strong>{integer(data.pageviews)}</strong>
            </article>
            <article>
              <span>Pages / visiteur</span>
              <strong>{decimal(data.pagesPerVisitor)}</strong>
            </article>
          </div>
          <p className="muted">
            Source : Vercel Web Analytics. Sur le plan Hobby, l’historique consultable est limité à environ 30 jours.
          </p>
        </>
      )}
    </section>
  );
}
