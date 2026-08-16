import type { MetadataRoute } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";

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
    url: `${base}/boutique/${encodeURIComponent(product.slug.trim().toLowerCase())}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...productPages,
    { url: `${base}/cgv`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/mentions-legales`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/confidentialite`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/livraison-retours`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
