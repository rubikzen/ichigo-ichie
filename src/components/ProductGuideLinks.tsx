"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { productMatchaFinderTags } from "@/lib/product-merchandising";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import type { Product } from "@/lib/types";

export function ProductGuideLinks({ product }: { product: Product }) {
  const { language } = useLanguage();
  const fr = language === "fr";
  if (product.type !== "product") return null;

  const tags = new Set(productMatchaFinderTags(product));
  const intentLinks = MATCHA_INTENT_SUMMARIES
    .filter((item) => tags.has(item.tag))
    .slice(0, 2)
    .map((item) => ({
      href: item.href,
      fr: item.titleFr,
      en: item.titleEn,
    }));

  const guideLink =
    tags.has("usucha") || tags.has("koicha")
      ? {
          href: "/guides/usucha-vs-koicha",
          fr: "Comprendre usucha et koicha",
          en: "Understand usucha and koicha",
        }
      : tags.has("ceremonial") || tags.has("latte")
        ? {
            href: "/guides/matcha-ceremonie-vs-latte",
            fr: "Cérémonie ou latte ?",
            en: "Ceremonial or latte?",
          }
        : {
            href: "/guides/comment-choisir-son-matcha",
            fr: "Comment choisir son matcha ?",
            en: "How to choose matcha",
          };

  const links = [
    ...intentLinks,
    guideLink,
    {
      href: "/matcha-nice",
      fr: "Découvrir le matcha à Nice",
      en: "Discover matcha in Nice",
    },
  ].slice(0, 4);

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
