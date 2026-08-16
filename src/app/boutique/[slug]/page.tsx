import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCachedCatalog } from "@/lib/catalog-server";
import { ProductPageContent } from "@/components/ProductPageContent";
import type { Product, Variant } from "@/lib/types";

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
  return value.trim().toLowerCase();
}

function productPath(product: Product) {
  return `/boutique/${encodeURIComponent(normalizedSlug(product.slug))}`;
}

async function getProductContext(slug: string) {
  const catalog = await getCachedCatalog("shop");
  const requestedSlug = normalizedSlug(slug);
  const product =
    catalog.products.find(
      (item) => normalizedSlug(item.slug) === requestedSlug,
    ) ?? null;
  const category = product
    ? catalog.categories.find((item) => item.id === product.category_id) ?? null
    : null;
  return { product, category };
}

function productDescription(product: Product) {
  return (
    product.description_fr ||
    product.description_en ||
    product.long_description_fr ||
    product.long_description_en ||
    `${product.name_fr} — sélection Ichigo Ichie.`
  );
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
  return catalog.products.map((product) => ({
    slug: normalizedSlug(product.slug),
  }));
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

  const path = productPath(product);
  const description = productDescription(product);
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
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <ProductPageContent
        product={product}
        categoryNameFr={category?.name_fr || ""}
        categoryNameEn={category?.name_en || category?.name_fr || ""}
      />
    </>
  );
}
