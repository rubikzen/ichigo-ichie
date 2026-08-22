"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Variant } from "@/lib/types";
import { InventoryForecastAdmin } from "./InventoryForecastAdmin";
import { RestockWaitlistAdmin } from "./RestockWaitlistAdmin";

type StockProduct = {
  id: string;
  name_fr: string;
};

export function AdminStockHub({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [labelsLoading, setLabelsLoading] = useState(true);
  const [labelsError, setLabelsError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadLabels() {
      setLabelsLoading(true);
      setLabelsError("");

      const { data: categories, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("kind", "shop");

      if (categoryError) {
        if (!cancelled) {
          setLabelsError(categoryError.message);
          setLabelsLoading(false);
        }
        return;
      }

      const categoryIds = (categories ?? []).map((row) => String(row.id));
      if (!categoryIds.length) {
        if (!cancelled) {
          setProducts([]);
          setVariants([]);
          setLabelsLoading(false);
        }
        return;
      }

      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("id,name_fr")
        .in("category_id", categoryIds)
        .limit(2000);

      if (productError) {
        if (!cancelled) {
          setLabelsError(productError.message);
          setLabelsLoading(false);
        }
        return;
      }

      const nextProducts = (productRows ?? []).map((row) => ({
        id: String(row.id),
        name_fr: String(row.name_fr ?? "").trim() || "Produit",
      }));
      const productIds = nextProducts.map((product) => product.id);

      let nextVariants: Variant[] = [];
      if (productIds.length) {
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select(
            "id,product_id,name,packaging,weight,price,stock,sku,active,image_url,shipping_weight_g",
          )
          .in("product_id", productIds)
          .limit(5000);

        if (variantError) {
          if (!cancelled) {
            setLabelsError(variantError.message);
            setLabelsLoading(false);
          }
          return;
        }

        nextVariants = (variantRows ?? []).map((row) => ({
          id: String(row.id),
          product_id: String(row.product_id),
          name: String(row.name ?? ""),
          packaging:
            row.packaging === "can" ||
            row.packaging === "bag" ||
            row.packaging === "other"
              ? row.packaging
              : null,
          weight: row.weight == null ? null : String(row.weight),
          price: Number(row.price ?? 0),
          stock: Number(row.stock ?? 0),
          sku: row.sku == null ? null : String(row.sku),
          active: row.active !== false,
          image_url: row.image_url == null ? null : String(row.image_url),
          shipping_weight_g:
            row.shipping_weight_g == null
              ? null
              : Number(row.shipping_weight_g),
        }));
      }

      if (!cancelled) {
        setProducts(nextProducts);
        setVariants(nextVariants);
        setLabelsLoading(false);
      }
    }

    void loadLabels();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <section className="admin-stock-hub-v476" aria-labelledby="admin-stock-title-v476">
      <header className="admin-workspace-head-v476">
        <div>
          <p className="eyebrow">CATALOGUE · STOCK</p>
          <h2 id="admin-stock-title-v476">Stock & réapprovisionnement</h2>
          <p>
            Prévoir les ruptures et suivre la demande client au même endroit.
          </p>
        </div>
      </header>

      <div className="admin-stock-section-v476">
        <InventoryForecastAdmin supabase={supabase} />
      </div>

      <div className="admin-stock-section-v476">
        {labelsError ? (
          <p className="save-message">
            Les libellés produits n’ont pas pu être chargés : {labelsError}
          </p>
        ) : labelsLoading ? (
          <p className="muted">Chargement des alertes retour en stock…</p>
        ) : (
          <RestockWaitlistAdmin
            supabase={supabase}
            products={products}
            variants={variants}
          />
        )}
      </div>
    </section>
  );
}
