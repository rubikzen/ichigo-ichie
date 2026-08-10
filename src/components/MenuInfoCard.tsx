"use client";

import type { Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

const money = (value: number, language: "fr" | "en") => new Intl.NumberFormat(
  language === "fr" ? "fr-FR" : "en-GB",
  { style: "currency", currency: "EUR" },
).format(value);

export function MenuInfoCard({ product }: { product: Product }) {
  const { language } = useLanguage();
  const name = (language === "fr" ? product.name_fr : product.name_en) || product.name_fr;
  const description = (language === "fr" ? product.description_fr : product.description_en) || product.description_fr || "";
  const gallery = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const image = gallery[0]?.url || product.image_url || "/product-placeholder.svg";

  return (
    <article className="menu-info-card">
      <div className="menu-info-media">
        <img src={image} alt={name} loading="lazy" />
        {product.badge && <span className="menu-info-badge">{product.badge}</span>}
      </div>
      <div className="menu-info-body">
        <div className="menu-info-title-row">
          <h4>{name}</h4>
          <strong>{money(product.base_price, language)}</strong>
        </div>
        {description && <p>{description}</p>}
      </div>
    </article>
  );
}
