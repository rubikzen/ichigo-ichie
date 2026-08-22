"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { productMatchaFinderTags } from "@/lib/product-merchandising";
import type { Product } from "@/lib/types";

export function ProductGuideLinks({ product }: { product: Product }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  if (product.type !== "product") return null;

  const tags = new Set(productMatchaFinderTags(product));
  const links = [
    {
      href: "/guides/comment-choisir-son-matcha",
      fr: "Comment choisir son matcha ?",
      en: "How to choose matcha",
      show: true,
    },
    {
      href: "/guides/usucha-vs-koicha",
      fr: "Usucha vs koicha",
      en: "Usucha vs koicha",
      show: tags.has("usucha") || tags.has("koicha"),
    },
    {
      href: "/guides/matcha-ceremonie-vs-latte",
      fr: "Matcha cérémonie ou latte ?",
      en: "Ceremonial matcha or latte?",
      show: tags.has("ceremonial") || tags.has("latte"),
    },
  ]
    .filter((item) => item.show)
    .slice(0, 2);

  return (
    <aside className="product-guide-links-v469" aria-label={fr ? "Guides liés à ce matcha" : "Guides related to this matcha"}>
      <span>{fr ? "Pour aller plus loin" : "Learn more"}</span>
      <div>
        {links.map((item) => (
          <Link key={item.href} href={item.href}>
            {fr ? item.fr : item.en} →
          </Link>
        ))}
      </div>
    </aside>
  );
}
