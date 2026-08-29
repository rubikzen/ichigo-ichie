"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { OrderStatistics } from "@/components/OrderStatistics";
import { ConversionAnalyticsAdmin } from "./ConversionAnalyticsAdmin";
import { TrafficAnalyticsAdmin } from "./TrafficAnalyticsAdmin";
import { ProductReviewsAdmin } from "./ProductReviewsAdmin";
import { SeoHealthAdmin } from "./SeoHealthAdmin";
import type { AdminNavigate } from "./AdminToday";

export type PilotageSection =
  | "overview"
  | "sales"
  | "traffic"
  | "conversion"
  | "seo"
  | "reviews";

const PILOTAGE_SECTIONS: Array<{
  id: PilotageSection;
  label: string;
}> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "sales", label: "Ventes" },
  { id: "traffic", label: "Trafic" },
  { id: "conversion", label: "Conversion" },
  { id: "seo", label: "SEO" },
  { id: "reviews", label: "Avis" },
];

export function AdminPilotage({
  supabase,
  section,
  onSectionChange,
  onNavigate,
}: {
  supabase: SupabaseClient;
  section: PilotageSection;
  onSectionChange: (section: PilotageSection) => void;
  onNavigate: AdminNavigate;
}) {
  return (
    <section className="admin-pilotage-v476" aria-labelledby="admin-pilotage-title-v476">
      <header className="admin-workspace-head-v476">
        <div>
          <p className="eyebrow">PILOTAGE</p>
          <h2 id="admin-pilotage-title-v476">Piloter la Boutique</h2>
          <p>
            Ventes, acquisition, visibilité et réputation — un seul diagnostic
            à la fois pour garder l’administration lisible et légère.
          </p>
        </div>
      </header>

      <nav
        className="admin-secondary-nav-v476"
        aria-label="Rubriques du pilotage"
      >
        {PILOTAGE_SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "active" : ""}
            aria-current={section === item.id ? "page" : undefined}
            onClick={() => onSectionChange(item.id)}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          className="admin-secondary-nav-jump-v476"
          onClick={() => onNavigate("catalog", "stock")}
        >
          Stocks & réappro ↗
        </button>
      </nav>

      {section === "overview" && (
        <div className="admin-pilotage-overview-v476">
          <button type="button" onClick={() => onSectionChange("sales")}>
            <span>VENTES</span>
            <strong>Chiffre d’affaires & commandes</strong>
            <small>
              CA, panier moyen, remboursements, top produits et exports.
            </small>
            <b>Analyser →</b>
          </button>

          <button type="button" onClick={() => onSectionChange("traffic")}>
            <span>TRAFIC</span>
            <strong>Visiteurs & pages vues</strong>
            <small>
              Audience réelle du site en production, hors administration et API.
            </small>
            <b>Analyser →</b>
          </button>

          <button type="button" onClick={() => onSectionChange("conversion")}>
            <span>CONVERSION</span>
            <strong>Parcours d’achat</strong>
            <small>
              Vues produit → panier → checkout → achat et CA attribué.
            </small>
            <b>Analyser →</b>
          </button>

          <button type="button" onClick={() => onNavigate("catalog", "stock")}>
            <span>STOCK</span>
            <strong>Prévisions & réapprovisionnement</strong>
            <small>
              Couverture, vitesse de vente et demandes de retour en stock.
            </small>
            <b>Gérer →</b>
          </button>

          <button type="button" onClick={() => onSectionChange("seo")}>
            <span>SEO</span>
            <strong>Santé des fiches publiques</strong>
            <small>
              Canonicals, metadata, images, Offer, contenu et schema.
            </small>
            <b>Auditer →</b>
          </button>

          <button type="button" onClick={() => onSectionChange("reviews")}>
            <span>AVIS</span>
            <strong>Réputation produit</strong>
            <small>
              Modération, publication, masquage et réponses de la maison.
            </small>
            <b>Modérer →</b>
          </button>
        </div>
      )}

      {section === "sales" && (
        <OrderStatistics supabase={supabase} refreshKey="pilotage-v476" />
      )}

      {section === "traffic" && (
        <TrafficAnalyticsAdmin supabase={supabase} />
      )}

      {section === "conversion" && (
        <ConversionAnalyticsAdmin supabase={supabase} />
      )}

      {section === "seo" && <SeoHealthAdmin supabase={supabase} />}

      {section === "reviews" && (
        <ProductReviewsAdmin supabase={supabase} />
      )}
    </section>
  );
}
