import type { MetadataRoute } from "next";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.ichigoichiematcha.fr").replace(/\/$/, "");
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();

  return [
    {
      url: `${base}/`,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/cgv`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/mentions-legales`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/confidentialite`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/livraison-retours`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
