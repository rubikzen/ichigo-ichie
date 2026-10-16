import type { Metadata } from "next";
import { getCachedCatalog } from "@/lib/catalog-server";
import { compactMenuProductForHome, compactShopProductForHome } from "@/lib/home-catalog";
import { HomePageContent } from "@/components/HomePageContent";
import { getPublicSiteSettings } from "@/lib/settings-server";
import { settingEnabled } from "@/lib/settings";
import "./styles/home-mobile-v496.css";

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
  const settings = await getPublicSiteSettings();
  const [menu, shop] = await Promise.all([
    settingEnabled(settings.menu_visible) ? getCachedCatalog("menu") : Promise.resolve({ categories: [], products: [] }),
    getCachedCatalog("shop"),
  ]);
  const compactShopProducts = shop.products.map(compactShopProductForHome);
  const highlightedShopProducts = compactShopProducts.filter((product) => product.featured);
  const shopFeaturedIds = (highlightedShopProducts.length ? highlightedShopProducts : compactShopProducts)
    .slice(0, 3)
    .map((product) => product.id);
  const compactMenuProducts = menu.products.map(compactMenuProductForHome);

  return (
    <HomePageContent
      shopFeaturedIds={shopFeaturedIds}
      menuCategories={menu.categories}
      menuProducts={compactMenuProducts}
      shopCategories={shop.categories}
      shopProducts={compactShopProducts}
    />
  );
}
