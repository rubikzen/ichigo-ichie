"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { productVariantLabel } from "@/lib/product-label";
import type { Variant } from "@/lib/types";

type AdminSupabase = NonNullable<ReturnType<typeof createBrowserSupabase>>;

type WaitlistProduct = {
  id: string;
  name_fr: string;
};

type WaitlistStatus = "active" | "notified" | "cancelled";

type WaitlistRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  email: string;
  locale: "fr" | "en";
  status: WaitlistStatus;
  created_at: string;
  notified_at: string | null;
  cancelled_at: string | null;
};

type WaitlistCounts = Record<WaitlistStatus, number>;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const statusLabels: Record<
  WaitlistStatus,
  { label: string; empty: string; eventLabel: string }
> = {
  active: {
    label: "Actives",
    empty: "Aucune demande active pour le moment.",
    eventLabel: "",
  },
  notified: {
    label: "Envoyées",
    empty: "Aucune alerte envoyée pour le moment.",
    eventLabel: "Envoyée",
  },
  cancelled: {
    label: "Annulées",
    empty: "Aucune alerte annulée pour le moment.",
    eventLabel: "Annulée",
  },
};

export function RestockWaitlistAdmin({
  supabase,
  products,
  variants,
}: {
  supabase: AdminSupabase;
  products: WaitlistProduct[];
  variants: Variant[];
}) {
  const [rows, setRows] = useState<WaitlistRow[]>([]);
  const [counts, setCounts] = useState<WaitlistCounts>({
    active: 0,
    notified: 0,
    cancelled: 0,
  });
  const [activeTab, setActiveTab] = useState<WaitlistStatus>("active");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboard = useCallback(async () => {
    const [rowsResult, activeResult, notifiedResult, cancelledResult] =
      await Promise.all([
        supabase
          .from("restock_subscriptions")
          .select(
            "id,product_id,variant_id,email,locale,status,created_at,notified_at,cancelled_at",
          )
          .eq("status", activeTab)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("restock_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("restock_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "notified"),
        supabase
          .from("restock_subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "cancelled"),
      ]);

    const loadError =
      rowsResult.error ||
      activeResult.error ||
      notifiedResult.error ||
      cancelledResult.error;

    return {
      data: (rowsResult.data ?? []) as WaitlistRow[],
      counts: {
        active: activeResult.count ?? 0,
        notified: notifiedResult.count ?? 0,
        cancelled: cancelledResult.count ?? 0,
      } satisfies WaitlistCounts,
      error: loadError,
    };
  }, [supabase, activeTab]);

  useEffect(() => {
    let cancelled = false;

    const applyDashboard = (result: Awaited<ReturnType<typeof fetchDashboard>>) => {
      if (cancelled) return;
      setRows(result.data);
      setCounts(result.counts);
      setError(result.error?.message || "");
      setLoading(false);
    };

    const reload = () => {
      void fetchDashboard().then(applyDashboard);
    };

    queueMicrotask(reload);
    window.addEventListener("ichigo:restock-processed", reload);

    return () => {
      cancelled = true;
      window.removeEventListener("ichigo:restock-processed", reload);
    };
  }, [fetchDashboard]);

  async function refresh() {
    setLoading(true);
    const result = await fetchDashboard();
    setRows(result.data);
    setCounts(result.counts);
    setError(result.error?.message || "");
    setLoading(false);
  }

  function chooseTab(status: WaitlistStatus) {
    if (status === activeTab) return;
    setLoading(true);
    setSearch("");
    setActiveTab(status);
  }

  const productNames = new Map(
    products.map((product) => [product.id, product.name_fr]),
  );
  const variantNames = new Map(
    variants.map((variant) => [
      variant.id,
      productVariantLabel(variant, "fr") || variant.name || "Format",
    ]),
  );

  const normalizedSearch = normalizeSearch(search);
  const visibleRows = rows.filter((row) => {
    if (!normalizedSearch) return true;

    const productName = productNames.get(row.product_id) || "Produit supprimé";
    const variantName = row.variant_id
      ? variantNames.get(row.variant_id) || "Format supprimé"
      : "Tous les formats";

    return normalizeSearch(
      `${row.email} ${productName} ${variantName}`,
    ).includes(normalizedSearch);
  });

  const selectedStatus = statusLabels[activeTab];
  const selectedCount = counts[activeTab];
  const isTruncated = selectedCount > rows.length;

  return (
    <details className="restock-admin-v425 restock-admin-v430" open>
      <summary>
        <div>
          <span className="restock-admin-kicker-v425">STOCK</span>
          <strong>Alertes retour en stock</strong>
          <small>
            {counts.active} active{counts.active > 1 ? "s" : ""} ·{" "}
            {counts.notified} envoyée{counts.notified > 1 ? "s" : ""} ·{" "}
            {counts.cancelled} annulée{counts.cancelled > 1 ? "s" : ""}
          </small>
        </div>
        <span className="restock-admin-count-v425">{counts.active}</span>
      </summary>

      <div className="restock-admin-body-v425">
        <div className="restock-admin-head-v425 restock-admin-head-v430">
          <p>
            Suivez les demandes actives, les alertes déjà envoyées et les
            annulations client sans modifier leur historique.
          </p>
          <button
            type="button"
            className="button ghost small"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? "Actualisation…" : "Actualiser"}
          </button>
        </div>

        <div
          className="restock-admin-tabs-v430"
          role="tablist"
          aria-label="Statut des alertes retour en stock"
        >
          {(Object.keys(statusLabels) as WaitlistStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={activeTab === status}
              className={activeTab === status ? "active" : ""}
              onClick={() => chooseTab(status)}
            >
              <span>{statusLabels[status].label}</span>
              <strong>{counts[status]}</strong>
            </button>
          ))}
        </div>

        <div className="restock-admin-tools-v430">
          <label>
            <span>Recherche</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Email, produit ou format…"
              aria-label="Rechercher une alerte par email, produit ou format"
            />
          </label>
          <small>
            {visibleRows.length} résultat{visibleRows.length > 1 ? "s" : ""} ·{" "}
            {selectedStatus.label.toLowerCase()}
          </small>
        </div>

        {error ? (
          <p className="save-message">
            Impossible de charger les alertes : {error}
          </p>
        ) : loading && rows.length === 0 ? (
          <p className="restock-admin-empty-v425">Chargement…</p>
        ) : visibleRows.length === 0 ? (
          <p className="restock-admin-empty-v425">
            {normalizedSearch
              ? "Aucun résultat pour cette recherche."
              : selectedStatus.empty}
          </p>
        ) : (
          <>
            {isTruncated && (
              <p className="restock-admin-limit-v430">
                Affichage des 500 alertes les plus récentes de cet onglet.
              </p>
            )}
            <div className="restock-admin-list-v425">
              {visibleRows.map((row) => {
                const eventAt =
                  row.status === "notified"
                    ? row.notified_at
                    : row.status === "cancelled"
                      ? row.cancelled_at
                      : null;

                return (
                  <div
                    className={`restock-admin-row-v425 restock-admin-row-v430 status-${row.status}`}
                    key={row.id}
                  >
                    <div className="restock-admin-product-v430">
                      <strong>
                        {productNames.get(row.product_id) || "Produit supprimé"}
                      </strong>
                      <small>
                        {row.variant_id
                          ? variantNames.get(row.variant_id) ||
                            "Format supprimé"
                          : "Tous les formats"}
                      </small>
                    </div>

                    <a href={`mailto:${row.email}`}>{row.email}</a>

                    <span className="restock-admin-locale-v430">
                      {row.locale.toUpperCase()}
                    </span>

                    <div className="restock-admin-dates-v430">
                      <span>
                        <b>Inscrite</b>
                        <time dateTime={row.created_at}>
                          {formatDate(row.created_at)}
                        </time>
                      </span>

                      {eventAt && (
                        <span>
                          <b>{selectedStatus.eventLabel}</b>
                          <time dateTime={eventAt}>
                            {formatDate(eventAt)}
                          </time>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
