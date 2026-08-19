"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { MenuInfoCard } from "./MenuInfoCard";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { subscribeCatalogUpdate } from "@/lib/catalog-events";

type CatalogBlockProps = {
  id: "menu" | "boutique";
  kind: "menu" | "shop";
  categories: Category[];
  products: Product[];
};

type SortMode = "recommended" | "price-asc" | "price-desc" | "name-asc" | "name-desc";

function productAvailableStock(product: Product) {
  const activeVariants = (product.variants ?? []).filter((variant) => variant.active);
  if (activeVariants.length) {
    return activeVariants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stock) || 0),
      0,
    );
  }
  return Math.max(0, Number(product.stock) || 0);
}

function productPrice(product: Product) {
  const activeVariants = (product.variants ?? []).filter((variant) => variant.active);
  if (!activeVariants.length) return Number(product.base_price) || 0;

  const availableVariants = activeVariants.filter((variant) => Number(variant.stock) > 0);
  const priceSource = availableVariants.length ? availableVariants : activeVariants;
  return Math.min(...priceSource.map((variant) => Number(variant.price) || 0));
}

function CatalogBlock({ id, kind, categories, products }: CatalogBlockProps) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");

  useEffect(() => subscribeCatalogUpdate(() => router.refresh()), [router]);

  const prefix = kind === "menu" ? "menu" : "shop";
  const val = (suffix: string) => settings[`${prefix}_${suffix}_${language}`] || settings[`${prefix}_${suffix}_fr`] || "";

  const label = (base: string, fallbackFr: string, fallbackEn: string) => settings[`${base}_${language}`] || settings[`${base}_fr`] || (language === "fr" ? fallbackFr : fallbackEn);
  const labels = {
    sort: label("catalog_sort_label", "Trier par", "Sort by"),
    recommended: label("catalog_sort_recommended", "Ordre recommandé", "Recommended"),
    priceAsc: label("catalog_sort_price_asc", "Prix : croissant", "Price: low to high"),
    priceDesc: label("catalog_sort_price_desc", "Prix : décroissant", "Price: high to low"),
    nameAsc: label("catalog_sort_name_asc", "Nom : A → Z", "Name: A → Z"),
    nameDesc: label("catalog_sort_name_desc", "Nom : Z → A", "Name: Z → A"),
  };

  const filtered = useMemo(() => products.filter((product) => (
    activeCategory === "all" || product.category_id === activeCategory
  )), [products, activeCategory]);

  const sortProducts = useCallback((items: Product[]) => [...items].sort((a, b) => {
    // V4.24: in the Boutique, purchasable products always stay ahead of
    // fully sold-out products. The selected sort mode is then applied
    // inside each availability group.
    if (kind === "shop") {
      const soldOutA = productAvailableStock(a) <= 0;
      const soldOutB = productAvailableStock(b) <= 0;
      if (soldOutA !== soldOutB) return soldOutA ? 1 : -1;
    }

    if (sortMode === "price-asc") return productPrice(a) - productPrice(b);
    if (sortMode === "price-desc") return productPrice(b) - productPrice(a);

    const nameA = (language === "fr" ? a.name_fr : a.name_en || a.name_fr).trim();
    const nameB = (language === "fr" ? b.name_fr : b.name_en || b.name_fr).trim();
    if (sortMode === "name-asc") return nameA.localeCompare(nameB, language, { sensitivity: "base" });
    if (sortMode === "name-desc") return nameB.localeCompare(nameA, language, { sensitivity: "base" });

    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  }), [kind, sortMode, language]);

  const groups = useMemo(() => categories.map((category) => ({
    category,
    products: sortProducts(filtered.filter((product) => product.category_id === category.id)),
  })).filter((group) => group.products.length > 0), [categories, filtered, sortProducts]);

  const uncategorized = useMemo(() => sortProducts(
    filtered.filter((product) => !categories.some((category) => category.id === product.category_id)),
  ), [categories, filtered, sortProducts]);

  const renderProduct = (product: Product) => kind === "menu"
    ? <MenuInfoCard key={product.id} product={product} compact />
    : <ProductCard key={product.id} product={product} />;

  return (
    <section
      className={`onepage-catalog onepage-catalog-${kind}${
        kind === "menu" ? " onepage-catalog-menu-compact-v449" : ""
      }`}
      id={id}
    >
      <div className="onepage-section-heading">
        <div>
          <p className="eyebrow">{val("eyebrow")}</p>
          <h2>{val("title")}</h2>
          <p>{val("intro")}</p>
          {kind === "menu" && <p className="menu-info-note">{val("info_note")}</p>}
        </div>
        <a className="onepage-backtop" href="#top" aria-label={language === "fr" ? "Retour en haut" : "Back to top"}>↑</a>
      </div>

      <div className="onepage-catalog-toolbar onepage-catalog-toolbar-v221 onepage-catalog-toolbar-v225">
        <div className="category-tabs onepage-category-tabs onepage-category-tabs-v225">
          <button className={activeCategory === "all" ? "active" : ""} aria-pressed={activeCategory === "all"} onClick={() => setActiveCategory("all")}>{val("all")}</button>
          {categories.map((category) => (
            <button key={category.id} className={activeCategory === category.id ? "active" : ""} aria-pressed={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>
              {language === "fr" ? category.name_fr : category.name_en || category.name_fr}
            </button>
          ))}
        </div>

        {kind === "shop" && (
          <label className="catalog-sort-v221">
            <span>{labels.sort}</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label={labels.sort}>
              <option value="recommended">{labels.recommended}</option>
              <option value="price-asc">{labels.priceAsc}</option>
              <option value="price-desc">{labels.priceDesc}</option>
              <option value="name-asc">{labels.nameAsc}</option>
              <option value="name-desc">{labels.nameDesc}</option>
            </select>
            <span className="catalog-sort-chevron-v221" aria-hidden="true">⌄</span>
          </label>
        )}
      </div>

      {filtered.length === 0 ? <div className="empty-state">{val("empty")}</div> : (
        <div className="onepage-category-groups">
          {groups.map(({ category, products: categoryProducts }) => (
            <section className="onepage-category-group" key={category.id}>
              <div className="onepage-category-heading">
                <h3>{language === "fr" ? category.name_fr : category.name_en || category.name_fr}</h3>
                <span>{categoryProducts.length}</span>
              </div>
              <div className={`product-grid onepage-product-grid ${kind === "menu" ? "menu-info-grid menu-compact-grid-v449" : ""} ${kind === "shop" && categoryProducts.length < 4 ? "product-grid-sparse-v412" : ""}`}>
                {categoryProducts.map(renderProduct)}
              </div>
            </section>
          ))}
          {uncategorized.length > 0 && (
            <section className="onepage-category-group">
              <div className={`product-grid onepage-product-grid ${kind === "menu" ? "menu-info-grid menu-compact-grid-v449" : ""} ${kind === "shop" && uncategorized.length < 4 ? "product-grid-sparse-v412" : ""}`}>
                {uncategorized.map(renderProduct)}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

export function UnifiedCatalogSections({
  menuCategories,
  menuProducts,
  shopCategories,
  shopProducts,
}: {
  menuCategories: Category[];
  menuProducts: Product[];
  shopCategories: Category[];
  shopProducts: Product[];
}) {
  const { language } = useLanguage();
  const tasting = language === "fr"
    ? {
        eyebrow: "DÉGUSTER SUR PLACE",
        title: "Vous souhaitez goûter avant de choisir ?",
        text: "Découvrez nos boissons et desserts préparés à Nice, puis retrouvez vos matchas préférés dans la Boutique.",
        cta: "Découvrir la carte",
      }
    : {
        eyebrow: "TASTE IN STORE",
        title: "Would you like to taste before choosing?",
        text: "Discover our drinks and desserts prepared in Nice, then find your favourite matchas in the Shop.",
        cta: "Explore the menu",
      };

  return (
    <>
      <CatalogBlock id="boutique" kind="shop" categories={shopCategories} products={shopProducts} />

      <section className="boutique-menu-bridge-v449" aria-labelledby="tasting-title-v449">
        <div>
          <p className="eyebrow">{tasting.eyebrow}</p>
          <h2 id="tasting-title-v449">{tasting.title}</h2>
          <p>{tasting.text}</p>
        </div>
        <a className="button ghost boutique-menu-bridge-cta-v449" href="#menu">
          {tasting.cta}
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <CatalogBlock id="menu" kind="menu" categories={menuCategories} products={menuProducts} />
    </>
  );
}
