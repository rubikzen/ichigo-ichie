import type { Metadata } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";
import { HomePageContent } from "@/components/HomePageContent";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Matcha japonais à Nice",
  description: "Découvrez Ichigo Ichie, maison de matcha japonais dans le Vieux Nice : matcha latte, boissons japonaises, matcha cérémonie et accessoires.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ichigo Ichie | Matcha japonais à Nice",
    description: "Matcha latte, boissons japonaises, matcha cérémonie et accessoires au cœur du Vieux Nice.",
    url: "/",
  },
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
