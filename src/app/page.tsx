import type { Metadata } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";
import { compactMenuProductForHome } from "@/lib/home-catalog";
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
  const highlightedShopProducts = shop.products.filter((product) => product.featured);
  const shopFeatured = (highlightedShopProducts.length ? highlightedShopProducts : shop.products).slice(0, 3);
  const compactMenuProducts = menu.products.map(compactMenuProductForHome);

  return (
    <HomePageContent
      shopFeatured={shopFeatured}
      menuCategories={menu.categories}
      menuProducts={compactMenuProducts}
      shopCategories={shop.categories}
      shopProducts={shop.products}
    />
  );
}
