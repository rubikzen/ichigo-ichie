import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getCachedCatalog } from "@/lib/catalog-server";
import { ProductPageContent } from "@/components/ProductPageContent";
import type { Product, Variant } from "@/lib/types";
import { sanitizeStorefrontProductText } from "@/lib/product-content";
import { getProductReviewSeoSnapshot } from "@/lib/product-review-seo";
import {
  normalizeProductSlug,
  productPublicPath,
  productPublicSlug,
} from "@/lib/product-url";

export const revalidate = 30;

type ProductPageParams = {
  params: Promise<{ slug: string }>;
};

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

function absoluteUrl(value: string | null | undefined) {
  const raw = String(value || "").trim() || "/product-placeholder.svg";
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.startsWith("/") ? raw : `/${raw}`, `${siteUrl()}/`).toString();
}

function normalizedSlug(value: string) {
  return normalizeProductSlug(value);
}

function productPath(product: Product) {
  return productPublicPath(product);
}

async function getProductContext(slug: string) {
  const catalog = await getCachedCatalog("shop");
  const requestedSlug = normalizedSlug(slug);
  const product =
    catalog.products.find(
      (item) =>
        normalizedSlug(item.slug) === requestedSlug ||
        productPublicSlug(item) === requestedSlug,
    ) ?? null;
  const category = product
    ? catalog.categories.find((item) => item.id === product.category_id) ?? null
    : null;
  return { product, category };
}

function productDescription(product: Product) {
  for (const candidate of [
    product.description_fr,
    product.description_en,
    product.long_description_fr,
    product.long_description_en,
  ]) {
    const sanitized = sanitizeStorefrontProductText(candidate);
    if (sanitized) return sanitized;
  }

  return `${product.name_fr} — sélection Ichigo Ichie.`;
}

function offerForVariant(product: Product, variant: Variant) {
  return {
    "@type": "Offer",
    url: `${siteUrl()}${productPath(product)}`,
    priceCurrency: "EUR",
    price: Number(variant.price).toFixed(2),
    availability:
      Number(variant.stock) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    ...(variant.sku ? { sku: variant.sku } : {}),
  };
}

function productOffers(product: Product) {
  const variants = product.variants.filter((variant) => variant.active);
  if (variants.length) {
    return variants.map((variant) => offerForVariant(product, variant));
  }

  return [{
    "@type": "Offer",
    url: `${siteUrl()}${productPath(product)}`,
    priceCurrency: "EUR",
    price: Number(product.base_price).toFixed(2),
    availability:
      Number(product.stock) > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
  }];
}

export async function generateStaticParams() {
  const catalog = await getCachedCatalog("shop");
  const storedSlugs = catalog.products.map((product) => ({
    slug: normalizedSlug(product.slug),
  }));
  const publicSlugs = catalog.products.map((product) => ({
    slug: productPublicSlug(product),
  }));

  return Array.from(
    new Map(
      [...storedSlugs, ...publicSlugs].map((item) => [item.slug, item]),
    ).values(),
  );
}

export async function generateMetadata({
  params,
}: ProductPageParams): Promise<Metadata> {
  const { slug } = await params;
  const { product } = await getProductContext(slug);

  if (!product) {
    return {
      title: "Produit introuvable",
      robots: { index: false, follow: false },
    };
  }

  const description = productDescription(product);
  const path = productPath(product);
  const previewImage =
    product.images?.[0]?.url || product.image_url || "/product-placeholder.svg";

  return {
    title: product.name_fr,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      url: path,
      title: product.name_fr,
      description,
      images: [{ url: previewImage, alt: product.name_fr }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name_fr,
      description,
      images: [previewImage],
    },
    robots: { index: true, follow: true },
  };
}

export default async function ProductPage({ params }: ProductPageParams) {
  const { slug } = await params;
  const { product, category } = await getProductContext(slug);

  if (!product) notFound();

  const requestedSlug = normalizedSlug(slug);
  const canonicalSlug = productPublicSlug(product);
  if (requestedSlug !== canonicalSlug) {
    permanentRedirect(productPath(product));
  }

  const path = productPath(product);
  const description = productDescription(product);
  const reviewSeo = await getProductReviewSeoSnapshot(product.id);
  const images = [
    ...(product.images ?? []).map((image) => absoluteUrl(image.url)),
    absoluteUrl(product.image_url),
  ].filter((value, index, rows) => rows.indexOf(value) === index);

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${siteUrl()}${path}#product`,
        name: product.name_fr,
        ...(product.name_en && product.name_en !== product.name_fr
          ? { alternateName: product.name_en }
          : {}),
        description,
        image: images,
        url: `${siteUrl()}${path}`,
        category: category?.name_fr || "Boutique",
        offers: productOffers(product),
        ...(reviewSeo
          ? {
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: reviewSeo.average,
                ratingCount: reviewSeo.count,
                reviewCount: reviewSeo.count,
                bestRating: 5,
                worstRating: 1,
              },
              ...(reviewSeo.reviews.length
                ? {
                    review: reviewSeo.reviews.map((review) => ({
                      "@type": "Review",
                      ...(review.title ? { name: review.title } : {}),
                      reviewBody: review.body,
                      datePublished: review.createdAt.slice(0, 10),
                      author: {
                        "@type": "Person",
                        name: review.authorName,
                      },
                      reviewRating: {
                        "@type": "Rating",
                        ratingValue: review.rating,
                        bestRating: 5,
                        worstRating: 1,
                      },
                    })),
                  }
                : {}),
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${siteUrl()}${path}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: `${siteUrl()}/` },
          { "@type": "ListItem", position: 2, name: "Boutique", item: `${siteUrl()}/#boutique` },
          { "@type": "ListItem", position: 3, name: product.name_fr, item: `${siteUrl()}${path}` },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        data-product-schema-v431
        data-product-review-schema-v474={reviewSeo ? "enabled" : "omitted"}
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <ProductPageContent product={product} />
    </>
  );
}
