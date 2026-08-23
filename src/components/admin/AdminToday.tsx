"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CommercialLaunchAdmin } from "./CommercialLaunchAdmin";

export type AdminArea =
  | "today"
  | "orders"
  | "catalog"
  | "pilotage"
  | "site"
  | "system";

export type AdminNavigate = (area: AdminArea, section?: string) => void;

type TodayOrder = {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string;
  source_channel: string | null;
  order_type: string;
  environment: string | null;
};

type TodayData = {
  newOrders: number;
  paymentAttention: number;
  pendingReviews: number;
  activeRestock: number;
  seoErrors: number;
  stockUrgent: number;
};

const EMPTY: TodayData = {
  newOrders: 0,
  paymentAttention: 0,
  pendingReviews: 0,
  activeRestock: 0,
  seoErrors: 0,
  stockUrgent: 0,
};

function isShopOrder(order: TodayOrder) {
  return (
    order.source_channel === "shop" ||
    order.source_channel === "mixed" ||
    (!order.source_channel && order.order_type === "shipping")
  );
}

function isTerminal(order: TodayOrder) {
  return ["completed", "cancelled", "refunded"].includes(order.status);
}

export function AdminToday({
  supabase,
  newContactCount,
  onNavigate,
  onOrderAttentionCount,
}: {
  supabase: SupabaseClient;
  newContactCount: number;
  onNavigate: AdminNavigate;
  onOrderAttentionCount: (count: number) => void;
}) {
  const [data, setData] = useState<TodayData>(EMPTY);
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
        const token = sessionData.session?.access_token || "";

        const [
          ordersResult,
          reviewsResult,
          restockResult,
          seoResponse,
          stockResponse,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select(
              "id,status,payment_status,payment_method,source_channel,order_type,environment",
            )
            .order("created_at", { ascending: false })
            .limit(500),
          supabase
            .from("product_reviews")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("restock_subscriptions")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
          token
            ? fetch("/api/admin/seo-health", {
                headers: { authorization: `Bearer ${token}` },
                cache: "no-store",
              })
            : Promise.resolve(null),
          token
            ? fetch("/api/admin/inventory-forecast?days=30", {
                headers: { authorization: `Bearer ${token}` },
                cache: "no-store",
              })
            : Promise.resolve(null),
        ]);

        const orders = ((ordersResult.data ?? []) as TodayOrder[]).filter(
          (order) => isShopOrder(order) && order.environment !== "test",
        );

        const newOrders = orders.filter(
          (order) =>
            order.status === "pending" &&
            (order.payment_method !== "online" ||
              order.payment_status === "paid"),
        ).length;

        const paymentAttention = orders.filter(
          (order) =>
            !isTerminal(order) &&
            order.payment_method === "online" &&
            ["failed", "expired", "refund_failed"].includes(
              order.payment_status,
            ),
        ).length;

        let seoErrors = 0;
        if (seoResponse?.ok) {
          const body = (await seoResponse.json()) as {
            summary?: { error?: number };
          };
          seoErrors = Math.max(0, Number(body.summary?.error) || 0);
        }

        let stockUrgent = 0;
        if (stockResponse?.ok) {
          const body = (await stockResponse.json()) as {
            summary?: { out?: number; urgent?: number };
          };
          stockUrgent =
            Math.max(0, Number(body.summary?.out) || 0) +
            Math.max(0, Number(body.summary?.urgent) || 0);
        }

        const next: TodayData = {
          newOrders,
          paymentAttention,
          pendingReviews: reviewsResult.count ?? 0,
          activeRestock: restockResult.count ?? 0,
          seoErrors,
          stockUrgent,
        };

        if (!cancelled) {
          setData(next);
          onOrderAttentionCount(newOrders + paymentAttention);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Le résumé du jour est indisponible.",
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
  }, [onOrderAttentionCount, refreshKey, supabase]);

  const attentionTotal = useMemo(
    () =>
      data.paymentAttention +
      data.stockUrgent +
      data.seoErrors +
      data.pendingReviews +
      newContactCount,
    [data, newContactCount],
  );

  return (
    <section className="admin-today-v476" aria-labelledby="admin-today-title-v476">
      <header className="admin-workspace-head-v476">
        <div>
          <p className="eyebrow">AUJOURD’HUI</p>
          <h2 id="admin-today-title-v476">Ce qui demande votre attention</h2>
          <p>
            Un point d’entrée opérationnel : traiter d’abord, analyser ensuite.
          </p>
        </div>
        <button
          type="button"
          className="button ghost small"
          disabled={loading}
          onClick={() => setRefreshKey((value) => value + 1)}
        >
          {loading ? "Actualisation…" : "Actualiser"}
        </button>
      </header>

      {error && <p className="save-message">{error}</p>}

      <div className="admin-today-primary-v476">
        <button type="button" onClick={() => onNavigate("orders", "orders")}>
          <span>COMMANDES</span>
          <strong>{data.newOrders}</strong>
          <small>Nouvelles à prendre en charge</small>
          <b>Ouvrir →</b>
        </button>

        <button type="button" onClick={() => onNavigate("site", "messages")}>
          <span>CONTACT</span>
          <strong>{newContactCount}</strong>
          <small>Nouveau{newContactCount > 1 ? "x" : ""} message{newContactCount > 1 ? "s" : ""}</small>
          <b>Ouvrir →</b>
        </button>

        <button type="button" onClick={() => onNavigate("pilotage", "reviews")}>
          <span>AVIS</span>
          <strong>{data.pendingReviews}</strong>
          <small>En attente de modération</small>
          <b>Modérer →</b>
        </button>
      </div>

      <section className="admin-today-attention-v476">
        <div className="admin-today-section-title-v476">
          <div>
            <span>ATTENTION</span>
            <strong>
              {attentionTotal
                ? `${attentionTotal} signal${attentionTotal > 1 ? "s" : ""} à regarder`
                : "Rien d’urgent détecté"}
            </strong>
          </div>
        </div>

        <div className="admin-today-attention-grid-v476">
          <button
            type="button"
            className={data.paymentAttention ? "has-alert" : ""}
            onClick={() => onNavigate("orders", "orders")}
          >
            <strong>{data.paymentAttention}</strong>
            <span>Paiements à vérifier</span>
          </button>

          <button
            type="button"
            className={data.stockUrgent ? "has-alert" : ""}
            onClick={() => onNavigate("catalog", "stock")}
          >
            <strong>{data.stockUrgent}</strong>
            <span>Stocks en rupture / ≤ 7 jours</span>
          </button>

          <button
            type="button"
            className={data.seoErrors ? "has-alert" : ""}
            onClick={() => onNavigate("pilotage", "seo")}
          >
            <strong>{data.seoErrors}</strong>
            <span>Fiches SEO à corriger</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate("catalog", "stock")}
          >
            <strong>{data.activeRestock}</strong>
            <span>Alertes retour en stock actives</span>
          </button>
        </div>
      </section>

      <CommercialLaunchAdmin
        supabase={supabase}
        onNavigate={onNavigate}
      />

      <section className="admin-today-shortcuts-v476">
        <div className="admin-today-section-title-v476">
          <div>
            <span>RACCOURCIS</span>
            <strong>Modifier rapidement</strong>
          </div>
        </div>
        <div>
          <button type="button" onClick={() => onNavigate("catalog", "products")}>
            Produits
            <small>Prix · stock · contenu · photos</small>
          </button>
          <button type="button" onClick={() => onNavigate("catalog", "promos")}>
            Promotions
            <small>Codes & campagnes</small>
          </button>
          <button type="button" onClick={() => onNavigate("site", "settings")}>
            Modifier le site
            <small>Accueil · Boutique · SEO · livraison</small>
          </button>
          <button type="button" onClick={() => onNavigate("pilotage", "overview")}>
            Pilotage
            <small>Ventes · conversion · SEO · avis</small>
          </button>
        </div>
      </section>

      <p className="admin-today-note-v476">
        {loading
          ? "Analyse des signaux actuels…"
          : "Lecture seule : cette vue ne modifie aucune commande, aucun stock ni aucun contenu."}
      </p>
    </section>
  );
}
