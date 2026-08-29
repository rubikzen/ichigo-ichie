import type { Metadata } from "next";
import { MatchaNiceLocalContent } from "@/components/MatchaNiceLocalContent";
import { getCachedCatalog } from "@/lib/catalog-server";
import {
  MATCHA_NICE_META,
  buildMatchaNiceFaq,
  type MatchaNiceStoreInfo,
} from "@/lib/matcha-nice-content";
import { getPublicSiteSettings } from "@/lib/settings-server";
import type { Product } from "@/lib/types";

export const revalidate = 30;

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

function instagramHref(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.instagram.com/${raw.replace(/^@/, "")}`;
}

function mapsHref(address: string, configured: string) {
  if (configured.trim()) return configured.trim();
  if (!address.trim()) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
}

function searchableMatcha(product: Product) {
  const value = [
    product.name_fr,
    product.name_en,
    product.description_fr,
    product.description_en,
  ]
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return value.includes("matcha");
}

function availableStock(product: Product) {
  const variants = product.variants.filter((variant) => variant.active);
  if (variants.length) {
    return variants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stock || 0)),
      0,
    );
  }
  return Math.max(0, Number(product.stock || 0));
}

export const metadata: Metadata = {
  title: MATCHA_NICE_META.title,
  description: MATCHA_NICE_META.description,
  alternates: { canonical: MATCHA_NICE_META.canonical },
  openGraph: {
    type: "website",
    title: `${MATCHA_NICE_META.title} | Ichigo Ichie`,
    description: MATCHA_NICE_META.description,
    url: MATCHA_NICE_META.canonical,
  },
  twitter: {
    card: "summary_large_image",
    title: MATCHA_NICE_META.title,
    description: MATCHA_NICE_META.description,
  },
};

export default async function MatchaNicePage() {
  const [settings, shop, menu] = await Promise.all([
    getPublicSiteSettings(),
    getCachedCatalog("shop"),
    getCachedCatalog("menu"),
  ]);

  const address = String(settings.store_address || "").trim();
  const store: MatchaNiceStoreInfo = {
    address,
    openingHours: String(settings.opening_hours || "").trim(),
    phone: String(settings.phone || "").trim(),
    email: String(settings.support_email || "").trim(),
    mapsHref: mapsHref(
      address,
      String(settings.store_maps_url || ""),
    ),
    instagramHref: instagramHref(String(settings.instagram || "")),
    menuInfoFr:
      settings.menu_info_note_fr ||
      "La carte est présentée à titre informatif. Les boissons et desserts ne sont pas commandables en ligne.",
    menuInfoEn:
      settings.menu_info_note_en ||
      "The menu is for information only. Drinks and desserts are not available for online ordering.",
  };

  const shopProducts = shop.products
    .filter((product) => product.type === "product" && searchableMatcha(product))
    .sort(
      (a, b) =>
        Number(availableStock(b) > 0) - Number(availableStock(a) > 0),
    )
    .slice(0, 6);

  const menuProducts = menu.products
    .filter(searchableMatcha)
    .slice(0, 6);

  const base = siteUrl();
  const pageUrl = `${base}${MATCHA_NICE_META.canonical}`;
  const faq = buildMatchaNiceFaq(store);

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: MATCHA_NICE_META.title,
        description: MATCHA_NICE_META.description,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${base}/#website` },
        about: { "@id": `${base}/#store` },
        mainEntity: { "@id": `${base}/#store` },
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#products`,
        name: "Sélection de matchas Ichigo Ichie à Nice",
        numberOfItems: shopProducts.length,
        itemListElement: shopProducts.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.name_fr,
          url: `${base}/boutique/${encodeURIComponent(
            product.slug.trim().toLowerCase(),
          )}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${base}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Matcha à Nice",
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.questionFr,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answerFr,
          },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <MatchaNiceLocalContent
        store={store}
        shopProducts={shopProducts}
        menuProducts={menuProducts}
      />
    </>
  );
}
