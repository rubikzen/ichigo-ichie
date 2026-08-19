"use client";

import type { Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { SafeImage } from "./SafeImage";

const money = (value: number, language: "fr" | "en") => new Intl.NumberFormat(
  language === "fr" ? "fr-FR" : "en-GB",
  { style: "currency", currency: "EUR" },
).format(value);

function badgeLengthClass(value: string) {
  const length = value.trim().length;
  if (length <= 8) return "badge-short-v385";
  if (length <= 12) return "badge-medium-v385";
  if (length <= 16) return "badge-long-v385";
  return "badge-xlong-v385";
}

export function MenuInfoCard({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const name = (language === "fr" ? product.name_fr : product.name_en) || product.name_fr;
  const description = (language === "fr" ? product.description_fr : product.description_en) || product.description_fr || "";
  const gallery = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const image = gallery[0]?.url || product.image_url || "/product-placeholder.svg";

  return (
    <article
      className={`menu-info-card${compact ? " menu-info-card-compact-v449" : ""}`}
    >
      <div className="menu-info-media">
        <SafeImage
          src={image}
          alt={name}
          width={800}
          height={640}
          sizes={
            compact
              ? "(max-width: 900px) 96px, 104px"
              : "(max-width: 720px) calc(100vw - 32px), (max-width: 1100px) 45vw, 360px"
          }
        />
        {product.badge && <span className={`menu-info-badge ${badgeLengthClass(product.badge)}`}>{product.badge}</span>}
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
