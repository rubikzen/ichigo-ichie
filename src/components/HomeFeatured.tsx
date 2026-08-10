"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";
import { MenuInfoCard } from "./MenuInfoCard";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";

const isMenuItem = (product: Product) => product.type === "drink" || product.type === "dessert" || product.type === "combo" || product.pickup_only;

export function HomeFeatured({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const eyebrow = language === "fr" ? settings.featured_eyebrow_fr : settings.featured_eyebrow_en;
  const title = language === "fr" ? settings.featured_title_fr : settings.featured_title_en;

  return (
    <section className="home-featured home-featured-v218">
      <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div></div>
      <div className="product-grid home-featured-grid-v220">
        {products.map((product) => isMenuItem(product)
          ? <MenuInfoCard key={product.id} product={product} />
          : <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
