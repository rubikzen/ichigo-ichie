"use client";

import { useEffect, useMemo, useState } from "react";
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

function productPrice(product: Product) {
  const activeVariants = (product.variants ?? []).filter((variant) => variant.active);
  if (!activeVariants.length) return Number(product.base_price) || 0;
  return Math.min(...activeVariants.map((variant) => Number(variant.price) || 0));
}

function normalizeCatalogSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function productSearchText(product: Product) {
  return normalizeCatalogSearch([
    product.name_fr,
    product.name_en,
    product.description_fr,
    product.description_en,
    product.long_description_fr,
    product.long_description_en,
    product.origin,
    product.cultivar,
    product.badge,
    ...(product.ideal_for ?? []),
    ...(product.variants ?? []).flatMap((variant) => [variant.name, variant.weight]),
  ].filter(Boolean).join(" "));
}

function CatalogBlock({ id, kind, categories, products }: CatalogBlockProps) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [searchQuery, setSearchQuery] = useState("");

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
    search: language === "fr" ? "Rechercher dans la Boutique" : "Search the Shop",
    searchPlaceholder: language === "fr" ? "Matcha, cultivar, origine, format…" : "Matcha, cultivar, origin, format…",
    clearSearch: language === "fr" ? "Effacer la recherche" : "Clear search",
    resetFilters: language === "fr" ? "Réinitialiser les filtres" : "Reset filters",
    noResultTitle: language === "fr" ? "Aucun produit trouvé" : "No products found",
    noResultText: language === "fr"
      ? "Essayez un autre mot-clé ou réinitialisez les filtres."
      : "Try another keyword or reset the filters.",
  };

  const normalizedQuery = normalizeCatalogSearch(searchQuery);
  const filtered = useMemo(() => products.filter((product) => {
    const categoryMatches = activeCategory === "all" || product.category_id === activeCategory;
    if (!categoryMatches) return false;
    if (kind !== "shop" || !normalizedQuery) return true;
    return productSearchText(product).includes(normalizedQuery);
  }), [products, activeCategory, kind, normalizedQuery]);

  const sortProducts = (items: Product[]) => [...items].sort((a, b) => {
    if (sortMode === "price-asc") return productPrice(a) - productPrice(b);
    if (sortMode === "price-desc") return productPrice(b) - productPrice(a);

    const nameA = (language === "fr" ? a.name_fr : a.name_en || a.name_fr).trim();
    const nameB = (language === "fr" ? b.name_fr : b.name_en || b.name_fr).trim();
    if (sortMode === "name-asc") return nameA.localeCompare(nameB, language, { sensitivity: "base" });
    if (sortMode === "name-desc") return nameB.localeCompare(nameA, language, { sensitivity: "base" });

    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const groups = useMemo(() => categories.map((category) => ({
    category,
    products: sortProducts(filtered.filter((product) => product.category_id === category.id)),
  })).filter((group) => group.products.length > 0), [categories, filtered, sortMode, language]);

  const uncategorized = useMemo(() => sortProducts(
    filtered.filter((product) => !categories.some((category) => category.id === product.category_id)),
  ), [categories, filtered, sortMode, language]);

  const renderProduct = (product: Product) => kind === "menu"
    ? <MenuInfoCard key={product.id} product={product} />
    : <ProductCard key={product.id} product={product} />;

  return (
    <section className={`onepage-catalog onepage-catalog-${kind}`} id={id}>
      <div className="onepage-section-heading">
        <div>
          <p className="eyebrow">{val("eyebrow")}</p>
          <h2>{val("title")}</h2>
          <p>{val("intro")}</p>
          {kind === "menu" && <p className="menu-info-note">{val("info_note")}</p>}
        </div>
        <a className="onepage-backtop" href="#top" aria-label={language === "fr" ? "Retour en haut" : "Back to top"}>↑</a>
      </div>

      {kind === "shop" && (
        <div className="catalog-search-row-v382">
          <label className="catalog-search-v382">
            <span className="sr-only">{labels.search}</span>
            <span className="catalog-search-icon-v382" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchQuery("");
                  event.currentTarget.blur();
                }
              }}
              placeholder={labels.searchPlaceholder}
              autoComplete="off"
              aria-label={labels.search}
            />
            {searchQuery && (
              <button type="button" className="catalog-search-clear-v382" onClick={() => setSearchQuery("")} aria-label={labels.clearSearch}>×</button>
            )}
          </label>
          <p className="catalog-result-count-v382" role="status" aria-live="polite">
            <strong>{filtered.length}</strong>
            <span>{language === "fr" ? ` produit${filtered.length > 1 ? "s" : ""}` : ` product${filtered.length === 1 ? "" : "s"}`}</span>
          </p>
        </div>
      )}

      <div className={`onepage-catalog-toolbar onepage-catalog-toolbar-v221 onepage-catalog-toolbar-v225${kind === "shop" ? " boutique-toolbar-v382" : ""}`}>
        <div className="category-tabs onepage-category-tabs onepage-category-tabs-v225">
          <button className={activeCategory === "all" ? "active" : ""} aria-pressed={activeCategory === "all"} onClick={() => setActiveCategory("all")}>{val("all")}</button>
          {categories.map((category) => (
            <button key={category.id} className={activeCategory === category.id ? "active" : ""} aria-pressed={activeCategory === category.id} onClick={() => setActiveCategory(category.id)}>
              {language === "fr" ? category.name_fr : category.name_en || category.name_fr}
            </button>
          ))}
        </div>

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
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state catalog-empty-v382">
          <strong>{kind === "shop" ? labels.noResultTitle : val("empty")}</strong>
          {kind === "shop" && <p>{labels.noResultText}</p>}
          {kind === "shop" && (
            <button type="button" className="button ghost" onClick={() => { setSearchQuery(""); setActiveCategory("all"); setSortMode("recommended"); }}>
              {labels.resetFilters}
            </button>
          )}
        </div>
      ) : (
        <div className="onepage-category-groups">
          {groups.map(({ category, products: categoryProducts }) => (
            <section className="onepage-category-group" key={category.id}>
              <div className="onepage-category-heading">
                <h3>{language === "fr" ? category.name_fr : category.name_en || category.name_fr}</h3>
                <span>{categoryProducts.length}</span>
              </div>
              <div className={`product-grid onepage-product-grid ${kind === "menu" ? "menu-info-grid" : ""}`}>
                {categoryProducts.map(renderProduct)}
              </div>
            </section>
          ))}
          {uncategorized.length > 0 && (
            <section className="onepage-category-group">
              <div className={`product-grid onepage-product-grid ${kind === "menu" ? "menu-info-grid" : ""}`}>
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
  return (
    <>
      <CatalogBlock id="menu" kind="menu" categories={menuCategories} products={menuProducts} />
      <div className="onepage-divider"><span>一期一会</span></div>
      <CatalogBlock id="boutique" kind="shop" categories={shopCategories} products={shopProducts} />
    </>
  );
}
