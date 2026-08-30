import Link from "next/link";
import type { ReactNode } from "react";
import { ShopCollectionProducts } from "@/components/ShopCollectionProducts";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import { categoryCollectionPath } from "@/lib/shop-collection-seo";
import type { Category, Product } from "@/lib/types";
import styles from "./ShopCollectionContent.module.css";

function LocalizedText({ fr, en }: { fr: ReactNode; en: ReactNode }) {
  return (
    <>
      <span className={styles.fr}>{fr}</span>
      <span className={styles.en}>{en}</span>
    </>
  );
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
  const currentTitleFr = currentCategory?.name_fr || "Boutique de matcha japonais";
  const currentTitleEn = currentCategory
    ? currentCategory.name_en || currentCategory.name_fr
    : "Japanese matcha shop";

  return (
    <main className="shop-collection-page-v473">
      <div className="shop-collection-shell-v473">
        <nav
          className="seo-breadcrumbs-v472 shop-collection-breadcrumb-v473"
          aria-label="Fil d’Ariane / Breadcrumb"
          data-seo-breadcrumbs-v472
        >
          <ol>
            <li>
              <Link href="/">
                <LocalizedText fr="Accueil" en="Home" />
              </Link>
            </li>
            <li>
              {currentCategory ? (
                <Link href="/boutique">Boutique</Link>
              ) : (
                <span aria-current="page">Boutique</span>
              )}
            </li>
            {currentCategory ? (
              <li>
                <span aria-current="page">
                  <LocalizedText fr={currentTitleFr} en={currentTitleEn} />
                </span>
              </li>
            ) : null}
          </ol>
        </nav>

        <header className="shop-collection-hero-v473">
          <div className="shop-collection-hero-copy-v478">
            <p className="eyebrow">
              <LocalizedText
                fr="ICHIGO ICHIE · SÉLECTION JAPONAISE"
                en="ICHIGO ICHIE · JAPANESE SELECTION"
              />
            </p>
            <h1>
              <LocalizedText fr={currentTitleFr} en={currentTitleEn} />
            </h1>
            <p>
              {currentCategory ? (
                <LocalizedText
                  fr={`Découvrez les références actuellement disponibles dans la collection ${currentCategory.name_fr}. Les prix, formats, stocks et avis viennent du catalogue Boutique en temps réel.`}
                  en={`Explore the products currently available in ${currentCategory.name_en || currentCategory.name_fr}. Prices, formats, stock and reviews come from the live Shop catalogue.`}
                />
              ) : (
                <LocalizedText
                  fr="Matcha japonais et accessoires sélectionnés pour différents usages, de l’usucha au latte. Les produits affichés ici utilisent exactement les mêmes données de prix, format et stock que le reste de la Boutique."
                  en="Japanese matcha and accessories selected for different uses, from usucha to latte. Products shown here use the same live price, format and stock data as the rest of the Shop."
                />
              )}
            </p>
          </div>
          <div className="shop-collection-hero-links-v473">
            <Link href="/guides">
              <LocalizedText fr="Guides du matcha →" en="Matcha guides →" />
            </Link>
            <Link href="/matcha-nice">
              <LocalizedText fr="Boutique à Nice →" en="Shop in Nice →" />
            </Link>
          </div>
        </header>

        <section
          className="shop-collection-taxonomy-v473"
          aria-label="Collections Boutique / Shop collections"
        >
          <div className="shop-collection-taxonomy-row-v478">
            <span className="shop-collection-taxonomy-label-v478">
              <LocalizedText fr="Catégorie" en="Category" />
            </span>
            <div className="shop-collection-category-links-v473">
              <Link
                href="/boutique"
                className={!currentCategory ? "active" : ""}
                aria-current={!currentCategory ? "page" : undefined}
              >
                <LocalizedText fr="Tout" en="All" />
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
                    <LocalizedText
                      fr={category.name_fr}
                      en={category.name_en || category.name_fr}
                    />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="shop-collection-taxonomy-row-v478">
            <span className="shop-collection-taxonomy-label-v478">
              <LocalizedText fr="Usage" en="Use" />
            </span>
            <div className="shop-collection-intent-links-v473">
              {MATCHA_INTENT_SUMMARIES.map((intent) => (
                <Link key={intent.href} href={intent.href}>
                  <LocalizedText fr={intent.labelFr} en={intent.labelEn} />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <ShopCollectionProducts products={products} />

        <section className="shop-collection-seo-bridge-v473">
          <div>
            <p className="eyebrow">
              <LocalizedText fr="MIEUX CHOISIR" en="CHOOSE WITH CONTEXT" />
            </p>
            <h2>
              <LocalizedText
                fr="Usage, préparation ou visite à Nice"
                en="Use, preparation or a visit in Nice"
              />
            </h2>
          </div>
          <div>
            <Link href="/guides/comment-choisir-son-matcha">
              <LocalizedText
                fr="Comment choisir son matcha ?"
                en="How to choose matcha"
              />{" "}
              →
            </Link>
            <Link href="/matcha-usucha">Usucha →</Link>
            <Link href="/matcha-koicha">Koicha →</Link>
            <Link href="/matcha-latte">Latte →</Link>
            <Link href="/matcha-ceremonie">
              <LocalizedText fr="Cérémonie" en="Ceremonial" /> →
            </Link>
            <Link href="/matcha-nice">Nice →</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
