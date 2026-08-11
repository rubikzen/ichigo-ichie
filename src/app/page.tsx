import type { Metadata } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";
import { HomePageContent } from "@/components/HomePageContent";

export const revalidate = 30;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  const [menu, shop] = await Promise.all([
    getCachedCatalog("menu"),
    getCachedCatalog("shop"),
  ]);
  const featured = menu.products.filter((product) => product.featured).slice(0, 4);
  const highlightedShopProducts = shop.products.filter((product) => product.featured);
  const shopFeatured = (highlightedShopProducts.length ? highlightedShopProducts : shop.products).slice(0, 3);

  return (
    <HomePageContent
      featured={featured}
      shopFeatured={shopFeatured}
      menuCategories={menu.categories}
      menuProducts={menu.products}
      shopCategories={shop.categories}
      shopProducts={shop.products}
    />
  );
}
