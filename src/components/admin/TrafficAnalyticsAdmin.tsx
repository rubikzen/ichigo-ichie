"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type GeoCountry = {
  countryCode: string;
  visits: number;
  pageviews: number;
  share: number;
};

type GeoCity = {
  countryCode: string;
  city: string;
  visits: number;
  pageviews: number;
};

type ProductClick = {
  productId: string;
  name: string;
  clicks: number;
  sessions: number;
  share: number;
};

type TrafficData = {
  available: boolean;
  source?: "first_party";
  periodDays: number;
  visits?: number;
  pageviews?: number;
  pagesPerVisit?: number;
  geo?: {
    topCountries: GeoCountry[];
    topCities: GeoCity[];
  };
  productClicks?: {
    total: number;
    topProducts: ProductClick[];
  };
  since?: string;
  until?: string;
  code?: string;
  message?: string;
  error?: string;
};

const PERIODS = [7, 30] as const;
const COUNTRY_NAMES: Record<string, string> = {
  FR: "France",
  BE: "Belgique",
  CH: "Suisse",
  DE: "Allemagne",
  IT: "Italie",
  ES: "Espagne",
  GB: "Royaume-Uni",
  US: "États-Unis",
  JP: "Japon",
  CA: "Canada",
  NL: "Pays-Bas",
  LU: "Luxembourg",
  PT: "Portugal",
  VN: "Vietnam",
  KR: "Corée du Sud",
  CN: "Chine",
  TW: "Taïwan",
};

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

function percent(value: number | undefined) {
  return `${decimal(value)} %`;
}

function countryFlag(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🌍";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0)),
  );
}

function countryLabel(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "Inconnu";
  return `${countryFlag(code)} ${COUNTRY_NAMES[code] || code}`;
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
          throw new Error(
            body.message || body.error || "Statistiques de trafic indisponibles.",
          );
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

  const countries = data?.geo?.topCountries ?? [];
  const cities = data?.geo?.topCities ?? [];
  const topProducts = data?.productClicks?.topProducts ?? [];

  return (
    <section
      className="conversion-analytics-v464"
      aria-label="Trafic du site"
      data-traffic-version="v4893"
    >
      <div className="conversion-analytics-head-v464">
        <div>
          <p className="eyebrow">TRAFIC</p>
          <h3>Visites du site</h3>
          <p className="muted">
            Sessions, provenance géographique et clics produit en production. L’administration et les API ne sont pas comptées.
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

      {!loading && data?.available && (
        <>
          <div className="conversion-kpis-v464">
            <article>
              <span>Visites</span>
              <strong>{integer(data.visits)}</strong>
            </article>
            <article>
              <span>Pages vues</span>
              <strong>{integer(data.pageviews)}</strong>
            </article>
            <article>
              <span>Pages / visite</span>
              <strong>{decimal(data.pagesPerVisit)}</strong>
            </article>
            <article>
              <span>Clics produit</span>
              <strong>{integer(data.productClicks?.total)}</strong>
            </article>
          </div>

          <div className="conversion-products-v464">
            <div>
              <h4>Pays</h4>
              <p className="muted">Provenance approximative fournie côté serveur par Vercel, sans stockage d’adresse IP.</p>
            </div>
            {countries.length ? (
              <div className="conversion-products-table-v464">
                <div className="conversion-product-row-v464 header"><span>Pays</span><span>Visites</span><span>Pages</span><span>Part</span></div>
                {countries.map((item) => (
                  <div className="conversion-product-row-v464" key={item.countryCode}>
                    <strong>{countryLabel(item.countryCode)}</strong>
                    <span>{integer(item.visits)}</span>
                    <span>{integer(item.pageviews)}</span>
                    <span>{percent(item.share)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Les pays apparaîtront avec les prochaines visites enregistrées.</p>
            )}
          </div>

          <div className="conversion-products-v464">
            <div>
              <h4>Villes</h4>
              <p className="muted">Ville estimée par le réseau Vercel ; elle peut être absente ou approximative selon la connexion du visiteur.</p>
            </div>
            {cities.length ? (
              <div className="conversion-products-table-v464">
                <div className="conversion-product-row-v464 header"><span>Ville</span><span>Pays</span><span>Visites</span><span>Pages</span></div>
                {cities.map((item) => (
                  <div className="conversion-product-row-v464" key={`${item.countryCode}-${item.city}`}>
                    <strong>{item.city}</strong>
                    <span>{countryLabel(item.countryCode)}</span>
                    <span>{integer(item.visits)}</span>
                    <span>{integer(item.pageviews)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Les villes apparaîtront avec les prochaines visites pour lesquelles Vercel fournit cette information.</p>
            )}
          </div>

          <div className="conversion-products-v464">
            <div>
              <h4>Produits les plus cliqués</h4>
              <p className="muted">Un clic correspond à l’ouverture de la fiche produit depuis une carte. Le suivi existant déduplique les ouvertures répétées du même produit pendant une même session.</p>
            </div>
            {topProducts.length ? (
              <div className="conversion-products-table-v464">
                <div className="conversion-product-row-v464 header"><span>Produit</span><span>Clics</span><span>Sessions</span><span>Part</span></div>
                {topProducts.map((product) => (
                  <div className="conversion-product-row-v464" key={product.productId}>
                    <strong>{product.name}</strong>
                    <span>{integer(product.clicks)}</span>
                    <span>{integer(product.sessions)}</span>
                    <span>{percent(product.share)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Pas encore de clic produit enregistré sur cette période.</p>
            )}
          </div>

          <p className="muted">
            Compteur first-party Ichigo Ichie par session, sans identité client ni IP stockée. Vercel Web Analytics reste actif en parallèle pour l’analyse détaillée.
          </p>
        </>
      )}
    </section>
  );
}
