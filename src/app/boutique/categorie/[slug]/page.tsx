import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopCollectionContent } from "@/components/ShopCollectionContent";
import { getCachedCatalog } from "@/lib/catalog-server";
import {
  buildShopCollectionStructuredData,
  categoryCollectionPath,
  collectionQueryHasState,
  normalizedCollectionSlug,
  type CollectionSearchParams,
} from "@/lib/shop-collection-seo";

export const revalidate = 30;

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CollectionSearchParams>;
};

async function getCategoryContext(slug: string) {
  const shop = await getCachedCatalog("shop");
  const normalized = normalizedCollectionSlug(slug);
  const category =
    shop.categories.find(
      (item) => normalizedCollectionSlug(item.slug) === normalized,
    ) ?? null;
  const products = category
    ? shop.products.filter((product) => product.category_id === category.id)
    : [];
  return { shop, category, products };
}

export async function generateStaticParams() {
  const shop = await getCachedCatalog("shop");
  return shop.categories.map((category) => ({
    slug: normalizedCollectionSlug(category.slug),
  }));
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const query = await searchParams;
  const { category, products } = await getCategoryContext(slug);

  if (!category) {
    return {
      title: "Collection introuvable",
      robots: { index: false, follow: false },
    };
  }

  const canonical = categoryCollectionPath(category);
  const title = `${category.name_fr} | Boutique Ichigo Ichie`;
  const description = `Découvrez ${category.name_fr} dans la Boutique Ichigo Ichie : ${products.length} ${products.length > 1 ? "références actuelles" : "référence actuelle"}, avec prix, formats et disponibilité à jour.`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: collectionQueryHasState(query)
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function CategoryCollectionPage({
  params,
}: CategoryPageProps) {
  const { slug } = await params;
  const { shop, category, products } = await getCategoryContext(slug);
  if (!category) notFound();

  const path = categoryCollectionPath(category);
  const title = `${category.name_fr} | Boutique Ichigo Ichie`;
  const description = `Collection ${category.name_fr} de la Boutique Ichigo Ichie, avec les produits actuellement disponibles.`;
  const structuredData = buildShopCollectionStructuredData({
    path,
    title,
    description,
    products,
    breadcrumbItems: [
      { name: "Accueil", path: "/" },
      { name: "Boutique", path: "/boutique" },
      { name: category.name_fr, path },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        data-shop-category-schema-v473
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <ShopCollectionContent
        categories={shop.categories}
        products={products}
        currentCategory={category}
      />
    </>
  );
}
