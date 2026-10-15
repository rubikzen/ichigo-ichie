"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SeoBreadcrumbs } from "@/components/SeoBreadcrumbs";
import { useLanguage } from "@/components/LanguageProvider";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import {
  categoryCollectionPath,
} from "@/lib/shop-collection-seo";
import type { Category, Product } from "@/lib/types";

// V500: keep the collection shell and language navigation lightweight while
// moving sorting, review summaries and ProductCard interactions to a separate
// client chunk. SSR stays enabled so the product catalogue remains visible in
// the initial HTML and there is no layout jump.
const ShopCollectionProductGrid = dynamic(() =>
  import("./ShopCollectionProductGrid").then(
    (module) => module.ShopCollectionProductGrid,
  ),
);

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
          <div className="shop-collection-hero-copy-v478">
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
          <div className="shop-collection-taxonomy-row-v478">
            <span className="shop-collection-taxonomy-label-v478">
              {fr ? "Catégorie" : "Category"}
            </span>
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
          </div>

          <div className="shop-collection-taxonomy-row-v478">
            <span className="shop-collection-taxonomy-label-v478">
              {fr ? "Usage" : "Use"}
            </span>
            <div className="shop-collection-intent-links-v473">
              {MATCHA_INTENT_SUMMARIES.map((intent) => (
                <Link key={intent.href} href={intent.href}>
                  {fr ? intent.labelFr : intent.labelEn}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <ShopCollectionProductGrid products={products} language={language} />

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
