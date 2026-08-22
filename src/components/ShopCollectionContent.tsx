"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { ReviewSummaryProvider } from "@/components/ReviewSummaryProvider";
import { SeoBreadcrumbs } from "@/components/SeoBreadcrumbs";
import { useLanguage } from "@/components/LanguageProvider";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import {
  categoryCollectionPath,
} from "@/lib/shop-collection-seo";
import type { Category, Product } from "@/lib/types";

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

export function ShopCollectionContent({
  categories,
  products,
  currentCategory = null,
}: {
  categories: Category[];
  products: Product[];
  currentCategory?: Category | null;
}) {
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

        const nameA = (
          fr ? a.name_fr : a.name_en || a.name_fr
        ).trim();
        const nameB = (
          fr ? b.name_fr : b.name_en || b.name_fr
        ).trim();

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

  const currentTitle = currentCategory
    ? fr
      ? currentCategory.name_fr
      : currentCategory.name_en || currentCategory.name_fr
    : fr
      ? "Boutique de matcha japonais"
      : "Japanese matcha shop";

  return (
    <main className="shop-collection-page-v473">
      <div className="shop-collection-shell-v473">
        <SeoBreadcrumbs
          className="shop-collection-breadcrumb-v473"
          ariaLabel={fr ? "Fil d’Ariane" : "Breadcrumb"}
          items={[
            { href: "/", label: fr ? "Accueil" : "Home" },
            currentCategory
              ? { href: "/boutique", label: "Boutique" }
              : { label: "Boutique" },
            ...(currentCategory ? [{ label: currentTitle }] : []),
          ]}
        />

        <header className="shop-collection-hero-v473">
          <div>
            <p className="eyebrow">
              {fr ? "ICHIGO ICHIE · SÉLECTION JAPONAISE" : "ICHIGO ICHIE · JAPANESE SELECTION"}
            </p>
            <h1>{currentTitle}</h1>
            <p>
              {currentCategory
                ? fr
                  ? `Découvrez les références actuellement disponibles dans la collection ${currentCategory.name_fr}. Les prix, formats, stocks et avis viennent du catalogue Boutique en temps réel.`
                  : `Explore the products currently available in ${currentCategory.name_en || currentCategory.name_fr}. Prices, formats, stock and reviews come from the live Shop catalogue.`
                : fr
                  ? "Matcha japonais et accessoires sélectionnés pour différents usages, de l’usucha au latte. Les produits affichés ici utilisent exactement les mêmes données de prix, format et stock que le reste de la Boutique."
                  : "Japanese matcha and accessories selected for different uses, from usucha to latte. Products shown here use the same live price, format and stock data as the rest of the Shop."}
            </p>
          </div>
          <div className="shop-collection-hero-links-v473">
            <Link href="/guides">
              {fr ? "Guides du matcha →" : "Matcha guides →"}
            </Link>
            <Link href="/matcha-nice">
              {fr ? "Boutique à Nice →" : "Shop in Nice →"}
            </Link>
          </div>
        </header>

        <section
          className="shop-collection-taxonomy-v473"
          aria-label={fr ? "Collections Boutique" : "Shop collections"}
        >
          <div className="shop-collection-category-links-v473">
            <Link
              href="/boutique"
              className={!currentCategory ? "active" : ""}
              aria-current={!currentCategory ? "page" : undefined}
            >
              {fr ? "Tout" : "All"}
            </Link>
            {categories.map((category) => {
              const active = currentCategory?.id === category.id;
              return (
                <Link
                  key={category.id}
                  href={categoryCollectionPath(category)}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  {fr
                    ? category.name_fr
                    : category.name_en || category.name_fr}
                </Link>
              );
            })}
          </div>

          <div className="shop-collection-intent-links-v473">
            <span>{fr ? "Choisir par usage" : "Choose by use"}</span>
            {MATCHA_INTENT_SUMMARIES.map((intent) => (
              <Link key={intent.href} href={intent.href}>
                {fr ? intent.labelFr : intent.labelEn}
              </Link>
            ))}
          </div>
        </section>

        <section
          className="shop-collection-products-v473"
          aria-labelledby="shop-collection-products-title-v473"
        >
          <div className="shop-collection-toolbar-v473">
            <div>
              <p className="eyebrow">
                {fr ? "CATALOGUE ACTUEL" : "CURRENT CATALOGUE"}
              </p>
              <h2 id="shop-collection-products-title-v473">
                {fr
                  ? `${products.length} ${products.length > 1 ? "références" : "référence"}`
                  : `${products.length} ${products.length === 1 ? "product" : "products"}`}
              </h2>
            </div>
            <label>
              <span>{fr ? "Trier par" : "Sort by"}</span>
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as SortMode)
                }
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
            <ReviewSummaryProvider
              productIds={sortedProducts.map((product) => product.id)}
            >
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

        <section className="shop-collection-seo-bridge-v473">
          <div>
            <p className="eyebrow">
              {fr ? "MIEUX CHOISIR" : "CHOOSE WITH CONTEXT"}
            </p>
            <h2>
              {fr
                ? "Usage, préparation ou visite à Nice"
                : "Use, preparation or a visit in Nice"}
            </h2>
          </div>
          <div>
            <Link href="/guides/comment-choisir-son-matcha">
              {fr ? "Comment choisir son matcha ?" : "How to choose matcha"} →
            </Link>
            <Link href="/matcha-usucha">Usucha →</Link>
            <Link href="/matcha-koicha">Koicha →</Link>
            <Link href="/matcha-latte">Latte →</Link>
            <Link href="/matcha-ceremonie">
              {fr ? "Cérémonie" : "Ceremonial"} →
            </Link>
            <Link href="/matcha-nice">Nice →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
