import type { Metadata } from "next";
import { ShopCollectionContent } from "@/components/ShopCollectionContent";
import { getCachedCatalog } from "@/lib/catalog-server";
import {
  buildShopCollectionStructuredData,
  canonicalForShopQuery,
  collectionQueryHasState,
  type CollectionSearchParams,
} from "@/lib/shop-collection-seo";

export const revalidate = 30;

type BoutiquePageProps = {
  searchParams: Promise<CollectionSearchParams>;
};

const TITLE = "Boutique de matcha japonais | Ichigo Ichie Nice";
const DESCRIPTION =
  "Découvrez la Boutique Ichigo Ichie : matcha japonais et accessoires, usages usucha, koicha, latte et dégustation, avec prix, formats et stock à jour.";

export async function generateMetadata({
  searchParams,
}: BoutiquePageProps): Promise<Metadata> {
  const params = await searchParams;
  const shop = await getCachedCatalog("shop");
  const hasState = collectionQueryHasState(params);
  const canonical = canonicalForShopQuery(params, shop.categories);

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical },
    robots: hasState
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

export default async function BoutiquePage() {
  const shop = await getCachedCatalog("shop");
  const structuredData = buildShopCollectionStructuredData({
    path: "/boutique",
    title: TITLE,
    description: DESCRIPTION,
    products: shop.products,
    breadcrumbItems: [
      { name: "Accueil", path: "/" },
      { name: "Boutique", path: "/boutique" },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        data-shop-collection-schema-v473
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <ShopCollectionContent
        categories={shop.categories}
        products={shop.products}
      />
    </>
  );
}
