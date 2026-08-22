"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { ProductCard } from "./ProductCard";
import { RitualBundleBuilder } from "./RitualBundleBuilder";
import { subscribeCatalogUpdate } from "@/lib/catalog-events";

type CatalogKind = "menu" | "shop";

export function CatalogGrid({ categories, products, kind }: { categories: Category[]; products: Product[]; kind: CatalogKind }) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => subscribeCatalogUpdate(() => router.refresh()), [router]);

  const filtered = useMemo(() => products.filter((product) => {
    const categoryOk = category === "all" || product.category_id === category;
    const haystack = `${product.name_fr} ${product.name_en} ${product.description_fr} ${product.description_en}`.toLowerCase();
    return categoryOk && haystack.includes(search.toLowerCase().trim());
  }), [products, category, search]);

  const prefix = kind === "menu" ? "menu" : "shop";
  const val = (suffix: string) => settings[`${prefix}_${suffix}_${language}`] || settings[`${prefix}_${suffix}_fr`] || "";

  return <section className={`catalog-page catalog-page-v218 catalog-${kind}-v218`}>
    <div className="page-heading page-heading-v218">
      <p className="eyebrow">{val("eyebrow")}</p>
      <h1>{val("title")}</h1>
      <p>{val("intro")}</p>
    </div>
    {kind === "shop" && <RitualBundleBuilder products={products} />}
    <div className="catalog-toolbar catalog-toolbar-v218">
      <div className="category-tabs">
        <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>{val("all")}</button>
        {categories.map((item) => <button key={item.id} className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)}>{language === "fr" ? item.name_fr : item.name_en}</button>)}
      </div>
      <div className="catalog-search-wrap-v218"><span>⌕</span><input className="catalog-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={val("search")} /></div>
    </div>
    {filtered.length ? <div className="product-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="empty-state">{val("empty")}</div>}
  </section>;
}
