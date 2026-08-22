"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  SeoHealthGlobalCheck,
  SeoHealthProductRow,
} from "@/lib/seo-health";

type SeoHealthData = {
  generatedAt: string;
  score: number;
  summary: {
    products: number;
    ready: number;
    warning: number;
    error: number;
    issues: number;
    reviewSchemaEligible: number;
  };
  globalChecks: SeoHealthGlobalCheck[];
  rows: SeoHealthProductRow[];
};

type View = "priority" | "all" | "error" | "warning" | "ready";

const STATUS_LABELS = {
  error: "À corriger",
  warning: "À améliorer",
  ready: "Prêt",
} as const;

function scoreLabel(value: number) {
  if (value >= 90) return "Très bon";
  if (value >= 75) return "Bon";
  if (value >= 60) return "À améliorer";
  return "Prioritaire";
}

export function SeoHealthAdmin({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [data, setData] = useState<SeoHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<View>("priority");
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

        const response = await fetch("/api/admin/seo-health", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as SeoHealthData & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(body.error || "Audit SEO indisponible.");
        }

        if (!cancelled) setData(body);
      } catch (loadError) {
        if (!cancelled) {
          setData(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Audit SEO indisponible.",
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
  }, [refreshKey, supabase]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("fr-FR");

    return (data?.rows ?? []).filter((row) => {
      if (view === "priority" && row.status === "ready") return false;
      if (view !== "priority" && view !== "all" && row.status !== view) {
        return false;
      }

      if (!query) return true;
      const haystack = [
        row.name,
        row.categoryName,
        row.path,
        ...row.issues.map((issue) => issue.label),
      ]
        .join(" ")
        .toLocaleLowerCase("fr-FR");
      return haystack.includes(query);
    });
  }, [data, search, view]);

  return (
    <section
      className="seo-health-admin-v475"
      aria-label="Santé SEO de la Boutique"
    >
      <div className="seo-health-head-v475">
        <div>
          <p className="eyebrow">SEO & INDEXATION</p>
          <h3>Santé SEO Boutique</h3>
          <p className="muted">
            Audit en lecture seule des produits publics : canonical, metadata,
            image, Offer, collection, qualité éditoriale, liens par usage et
            avis approuvés.
          </p>
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

      {loading && <p className="muted">Analyse du catalogue public…</p>}

      {!loading && error && (
        <div className="seo-health-empty-v475">
          <strong>Audit SEO indisponible</strong>
          <span>{error}</span>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="seo-health-kpis-v475">
            <article>
              <span>Score moyen</span>
              <strong>{data.score}/100</strong>
              <small>{scoreLabel(data.score)}</small>
            </article>
            <article className={data.summary.error ? "alert" : ""}>
              <span>À corriger</span>
              <strong>{data.summary.error}</strong>
              <small>erreur(s) critique(s)</small>
            </article>
            <article>
              <span>À améliorer</span>
              <strong>{data.summary.warning}</strong>
              <small>sans erreur bloquante</small>
            </article>
            <article>
              <span>Prêts</span>
              <strong>{data.summary.ready}</strong>
              <small>sur {data.summary.products} produit(s)</small>
            </article>
            <article>
              <span>AggregateRating</span>
              <strong>{data.summary.reviewSchemaEligible}</strong>
              <small>produit(s) éligible(s)</small>
            </article>
          </div>

          <div className="seo-health-global-v475">
            {data.globalChecks.map((check) => (
              <article
                key={check.id}
                className={`seo-health-global-${check.status}-v475`}
              >
                <span aria-hidden="true">
                  {check.status === "ok"
                    ? "✓"
                    : check.status === "error"
                      ? "!"
                      : "•"}
                </span>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.detail}</small>
                </div>
              </article>
            ))}
          </div>

          <div className="seo-health-toolbar-v475">
            <div className="seo-health-views-v475">
              {(
                [
                  ["priority", "Priorités"],
                  ["all", "Tous"],
                  ["error", "Erreurs"],
                  ["warning", "À améliorer"],
                  ["ready", "Prêts"],
                ] as Array<[View, string]>
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={view === value ? "active" : ""}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Produit, collection, problème…"
              aria-label="Rechercher dans l’audit SEO"
            />
          </div>

          {visibleRows.length ? (
            <div className="seo-health-table-v475">
              <div className="seo-health-row-v475 header">
                <span>Produit</span>
                <span>Score</span>
                <span>Signaux</span>
                <span>Points à traiter</span>
                <span>Page</span>
              </div>

              {visibleRows.map((row) => (
                <div className="seo-health-row-v475" key={row.id}>
                  <div className="seo-health-product-v475">
                    <strong>{row.name}</strong>
                    <small>{row.categoryName}</small>
                    <code>{row.path}</code>
                  </div>

                  <div data-label="Score">
                    <strong>{row.score}</strong>
                    <span
                      className={`seo-health-status-v475 ${row.status}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </div>

                  <div
                    className="seo-health-signals-v475"
                    data-label="Signaux"
                  >
                    <span>
                      Meta {row.signals.titleLength}/
                      {row.signals.descriptionLength}
                    </span>
                    <span>
                      {row.signals.hasImage ? "Image ✓" : "Image —"}
                    </span>
                    <span>{row.signals.offerCount} offre(s)</span>
                    {row.signals.finderTags.length > 0 && (
                      <span>{row.signals.finderTags.join(" · ")}</span>
                    )}
                    {row.signals.review.count > 0 && (
                      <span>
                        {row.signals.review.average.toFixed(1)}/5 ·{" "}
                        {row.signals.review.count} avis
                        {row.signals.review.schemaEligible ? " · schema ✓" : ""}
                      </span>
                    )}
                  </div>

                  <div
                    className="seo-health-issues-v475"
                    data-label="Points à traiter"
                  >
                    {row.issues.length ? (
                      <>
                        {row.issues.slice(0, 3).map((issue) => (
                          <span
                            key={issue.code}
                            className={issue.level}
                          >
                            {issue.label}
                          </span>
                        ))}
                        {row.issues.length > 3 && (
                          <small>
                            +{row.issues.length - 3} autre(s) signal(aux)
                          </small>
                        )}
                      </>
                    ) : (
                      <span className="ready">
                        Aucun signal SEO à traiter
                      </span>
                    )}
                  </div>

                  <div className="seo-health-links-v475" data-label="Page">
                    <a href={row.path} target="_blank" rel="noreferrer">
                      Voir la fiche ↗
                    </a>
                    {row.categoryPath && (
                      <a
                        href={row.categoryPath}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Collection ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="seo-health-empty-v475">
              <strong>
                {view === "priority"
                  ? "Aucune priorité SEO dans cette vue."
                  : "Aucun produit ne correspond aux filtres."}
              </strong>
              <span>
                Modifiez la vue ou la recherche pour afficher d’autres fiches.
              </span>
            </div>
          )}

          <div className="seo-health-foot-v475">
            <span>{data.summary.issues} signal(aux) détecté(s)</span>
            <span>
              Généré le{" "}
              {new Date(data.generatedAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
            <span>Lecture seule · catalogue Boutique actif uniquement</span>
          </div>
        </>
      )}
    </section>
  );
}
