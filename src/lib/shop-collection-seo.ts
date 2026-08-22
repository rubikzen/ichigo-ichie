import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import type { Category, Product } from "@/lib/types";

export type CollectionSearchParams = Record<
  string,
  string | string[] | undefined
>;

export function normalizedCollectionSlug(value: string) {
  return value.trim().toLowerCase();
}

export function categoryCollectionPath(category: Pick<Category, "slug">) {
  return `/boutique/categorie/${encodeURIComponent(
    normalizedCollectionSlug(category.slug),
  )}`;
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function hasValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.some((item) => String(item).trim());
  return Boolean(String(value || "").trim());
}

export function collectionQueryHasState(params: CollectionSearchParams) {
  return Object.values(params).some(hasValue);
}

export function canonicalForShopQuery(
  params: CollectionSearchParams,
  categories: Category[],
) {
  const categorySlug = normalizedCollectionSlug(firstParam(params.category));
  const usage = firstParam(params.usage).toLowerCase();
  const meaningfulOtherKeys = Object.entries(params)
    .filter(([key]) => !["category", "usage", "sort"].includes(key))
    .some(([, value]) => hasValue(value));

  if (!meaningfulOtherKeys && categorySlug && !usage) {
    const category = categories.find(
      (item) => normalizedCollectionSlug(item.slug) === categorySlug,
    );
    if (category) return categoryCollectionPath(category);
  }

  if (!meaningfulOtherKeys && usage && !categorySlug) {
    const intent = MATCHA_INTENT_SUMMARIES.find(
      (item) => item.tag === usage,
    );
    if (intent) return intent.href;
  }

  return "/boutique";
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

export function buildShopCollectionStructuredData({
  path,
  title,
  description,
  products,
  breadcrumbItems,
}: {
  path: string;
  title: string;
  description: string;
  products: Product[];
  breadcrumbItems: Array<{ name: string; path: string }>;
}) {
  const base = siteUrl();
  const pageUrl = `${base}${path}`;

  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: title,
        description,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${base}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: products.length,
          itemListElement: products.map((product, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: product.name_fr,
            url: `${base}/boutique/${encodeURIComponent(
              normalizedCollectionSlug(product.slug),
            )}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${base}${item.path}`,
        })),
      },
    ],
  }).replace(/</g, "\\u003c");
}
