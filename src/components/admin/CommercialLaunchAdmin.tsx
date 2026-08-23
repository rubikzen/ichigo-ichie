"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommercialIssue } from "@/lib/commercial-launch";
import type { AdminNavigate } from "@/components/admin/AdminToday";

type LaunchReport = {
  status: "blocked" | "review" | "ready";
  summary: {
    blockers: number;
    warnings: number;
    activeProducts: number;
    blockedFoodProducts: number;
  };
  issues: CommercialIssue[];
  generatedAt: string;
};

export function CommercialLaunchAdmin({
  supabase,
  onNavigate,
}: {
  supabase: SupabaseClient;
  onNavigate: AdminNavigate;
}) {
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;

        const response = await fetch("/api/admin/commercial-launch-health", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const body = (await response.json()) as LaunchReport & {
          error?: string;
        };
        if (!response.ok) throw new Error(body.error || "Audit indisponible.");
        if (!cancelled) setReport(body);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Audit commercial indisponible.",
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const state = report?.status ?? "review";
  const stateLabel =
    state === "ready"
      ? "PRÊT À VENDRE"
      : state === "blocked"
        ? "LANCEMENT BLOQUÉ"
        : "À VÉRIFIER";

  return (
    <section
      className={`commercial-launch-admin-v483 state-${state}`}
      aria-labelledby="commercial-launch-title-v483"
      data-commercial-launch-v483
    >
      <header>
        <div>
          <p className="eyebrow">GO LIVE</p>
          <h3 id="commercial-launch-title-v483">Contrôle commercial</h3>
          <p>
            Produits alimentaires, contenu catalogue et informations légales
            avant ouverture commerciale.
          </p>
        </div>
        <strong>{stateLabel}</strong>
      </header>

      {error && <p className="save-message">{error}</p>}

      {report && (
        <>
          <div className="commercial-launch-summary-v483">
            <div>
              <span>Blocages</span>
              <strong>{report.summary.blockers}</strong>
            </div>
            <div>
              <span>Avertissements</span>
              <strong>{report.summary.warnings}</strong>
            </div>
            <div>
              <span>Produits actifs</span>
              <strong>{report.summary.activeProducts}</strong>
            </div>
            <div>
              <span>Alimentaire incomplet</span>
              <strong>{report.summary.blockedFoodProducts}</strong>
            </div>
          </div>

          {report.issues.length ? (
            <div className="commercial-launch-issues-v483">
              {report.issues.slice(0, 20).map((issue, index) => (
                <button
                  type="button"
                  key={`${issue.code}-${issue.productId ?? "site"}-${index}`}
                  className={issue.level}
                  onClick={() => onNavigate(issue.area, issue.section)}
                >
                  <span>
                    {issue.level === "error" ? "Bloquant" : "À vérifier"}
                  </span>
                  <strong>
                    {issue.productName
                      ? `${issue.productName} · ${issue.label}`
                      : issue.label}
                  </strong>
                  <b>Corriger →</b>
                </button>
              ))}
            </div>
          ) : (
            <p className="commercial-launch-ready-v483">
              ✓ Aucun blocage commercial détecté par V483.
            </p>
          )}

          <small className="commercial-launch-disclaimer-v483">
            Ce contrôle aide à éviter les oublis techniques et éditoriaux. Il
            ne remplace pas la validation de vos étiquettes, documents
            fournisseurs ni vos obligations juridiques.
          </small>
        </>
      )}
    </section>
  );
}
