import type { MetadataRoute } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import { productPublicPath } from "@/lib/product-url";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const shop = await getCachedCatalog("shop");

  const productPages: MetadataRoute.Sitemap = shop.products.map((product) => ({
    url: `${base}${productPublicPath(product)}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const collectionPages: MetadataRoute.Sitemap = [
    {
      url: `${base}/boutique`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...shop.categories.map((category) => ({
      url: `${base}/boutique/categorie/${encodeURIComponent(
        category.slug.trim().toLowerCase(),
      )}`,
      changeFrequency: "daily" as const,
      priority: 0.78,
    })),
  ];

  const guidePages: MetadataRoute.Sitemap = [
    {
      url: `${base}/guides`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/guides/comment-choisir-son-matcha`,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${base}/guides/usucha-vs-koicha`,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${base}/guides/matcha-ceremonie-vs-latte`,
      changeFrequency: "monthly",
      priority: 0.75,
    },
  ];

  const intentPages: MetadataRoute.Sitemap =
    MATCHA_INTENT_SUMMARIES.map((page) => ({
      url: `${base}${page.href}`,
      changeFrequency: "daily",
      priority: 0.85,
    }));

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...collectionPages,
    ...productPages,
    ...guidePages,
    ...intentPages,
    {
      url: `${base}/matcha-nice`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    { url: `${base}/cgv`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/mentions-legales`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/livraison-retours`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
