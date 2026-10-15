"use client";

import { useCallback, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ReviewSummaryProvider } from "@/components/ReviewSummaryProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { Product } from "@/lib/types";

type SortMode =
  | "recommended"
  | "price-asc"
  | "price-desc"
  | "name-asc"
  | "name-desc";

function productAvailableStock(product: Product) {
  const variants = product.variants.filter((variant) => variant.active);
  if (variants.length) {
    return variants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stock) || 0),
      0,
    );
  }
  return Math.max(0, Number(product.stock) || 0);
}

function productPrice(product: Product) {
  const variants = product.variants.filter((variant) => variant.active);
  if (!variants.length) return Number(product.base_price) || 0;
  const available = variants.filter((variant) => Number(variant.stock) > 0);
  const source = available.length ? available : variants;
  return Math.min(...source.map((variant) => Number(variant.price) || 0));
}

export function ShopCollectionProducts({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const [sortMode, setSortMode] = useState<SortMode>("recommended");

  const sortProducts = useCallback(
    (items: Product[]) =>
      [...items].sort((a, b) => {
        const soldOutA = productAvailableStock(a) <= 0;
        const soldOutB = productAvailableStock(b) <= 0;
        if (soldOutA !== soldOutB) return soldOutA ? 1 : -1;

        if (sortMode === "price-asc") return productPrice(a) - productPrice(b);
        if (sortMode === "price-desc") return productPrice(b) - productPrice(a);

        const nameA = (fr ? a.name_fr : a.name_en || a.name_fr).trim();
        const nameB = (fr ? b.name_fr : b.name_en || b.name_fr).trim();

        if (sortMode === "name-asc") {
          return nameA.localeCompare(nameB, language, { sensitivity: "base" });
        }
        if (sortMode === "name-desc") {
          return nameB.localeCompare(nameA, language, { sensitivity: "base" });
        }
        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
      }),
    [fr, language, sortMode],
  );

  const sortedProducts = useMemo(
    () => sortProducts(products),
    [products, sortProducts],
  );

  return (
    <section
      className="shop-collection-products-v473"
      aria-labelledby="shop-collection-products-title-v473"
    >
      <div className="shop-collection-toolbar-v473">
        <div className="shop-collection-count-v478">
          <p className="eyebrow">
            {fr ? "CATALOGUE ACTUEL" : "CURRENT CATALOGUE"}
          </p>
          <h2 id="shop-collection-products-title-v473">
            {fr
              ? `${products.length} ${products.length > 1 ? "références" : "référence"}`
              : `${products.length} ${products.length === 1 ? "product" : "products"}`}
          </h2>
        </div>
        <label className="shop-collection-sort-v478">
          <span>{fr ? "Trier par" : "Sort by"}</span>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            aria-label={fr ? "Trier les produits" : "Sort products"}
          >
            <option value="recommended">
              {fr ? "Ordre recommandé" : "Recommended"}
            </option>
            <option value="price-asc">
              {fr ? "Prix : croissant" : "Price: low to high"}
            </option>
            <option value="price-desc">
              {fr ? "Prix : décroissant" : "Price: high to low"}
            </option>
            <option value="name-asc">
              {fr ? "Nom : A → Z" : "Name: A → Z"}
            </option>
            <option value="name-desc">
              {fr ? "Nom : Z → A" : "Name: Z → A"}
            </option>
          </select>
        </label>
      </div>

      {sortedProducts.length ? (
        <ReviewSummaryProvider productIds={sortedProducts.map((product) => product.id)}>
          <div className="product-grid shop-collection-grid-v473">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </ReviewSummaryProvider>
      ) : (
        <div className="shop-collection-empty-v473">
          {fr
            ? "Aucun produit n’est actuellement disponible dans cette collection."
            : "No products are currently available in this collection."}
        </div>
      )}
    </section>
  );
}
