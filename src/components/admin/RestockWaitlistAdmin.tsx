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

type WaitlistRow = {
  id: string;
  product_id: string;
  variant_id: string | null;
  email: string;
  locale: "fr" | "en";
  status: "active" | "notified" | "cancelled";
  created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRows = useCallback(
    () =>
      supabase
        .from("restock_subscriptions")
        .select("id,product_id,variant_id,email,locale,status,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200),
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;

    const applyRows = (data: unknown, loadError: { message?: string } | null) => {
      if (cancelled) return;
      setRows((data ?? []) as WaitlistRow[]);
      setError(loadError?.message || "");
      setLoading(false);
    };

    const reload = () => {
      void fetchRows().then(({ data, error: loadError }) => {
        applyRows(data, loadError);
      });
    };

    queueMicrotask(reload);
    window.addEventListener("ichigo:restock-processed", reload);

    return () => {
      cancelled = true;
      window.removeEventListener("ichigo:restock-processed", reload);
    };
  }, [fetchRows]);

  async function refresh() {
    setLoading(true);
    const { data, error: loadError } = await fetchRows();
    setRows((data ?? []) as WaitlistRow[]);
    setError(loadError ? loadError.message : "");
    setLoading(false);
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

  return (
    <details className="restock-admin-v425" open={rows.length > 0}>
      <summary>
        <div>
          <span className="restock-admin-kicker-v425">STOCK</span>
          <strong>Liste d’attente retour en stock</strong>
          <small>
            {rows.length} inscription{rows.length > 1 ? "s" : ""} active
            {rows.length > 1 ? "s" : ""}
          </small>
        </div>
        <span className="restock-admin-count-v425">{rows.length}</span>
      </summary>

      <div className="restock-admin-body-v425">
        <div className="restock-admin-head-v425">
          <p>
            Les alertes sont envoyées automatiquement dès qu’un produit ou un
            format redevient disponible. Une inscription disparaît de cette
            liste après un envoi réussi.
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

        {error ? (
          <p className="save-message">
            Impossible de charger la liste : {error}
          </p>
        ) : loading && rows.length === 0 ? (
          <p className="restock-admin-empty-v425">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="restock-admin-empty-v425">
            Aucune demande de retour en stock pour le moment.
          </p>
        ) : (
          <div className="restock-admin-list-v425">
            {rows.map((row) => (
              <div className="restock-admin-row-v425" key={row.id}>
                <div>
                  <strong>
                    {productNames.get(row.product_id) || "Produit supprimé"}
                  </strong>
                  <small>
                    {row.variant_id
                      ? variantNames.get(row.variant_id) || "Format supprimé"
                      : "Tous les formats"}
                  </small>
                </div>
                <a href={`mailto:${row.email}`}>{row.email}</a>
                <span>{row.locale.toUpperCase()}</span>
                <time dateTime={row.created_at}>
                  {new Intl.DateTimeFormat("fr-FR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(row.created_at))}
                </time>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
