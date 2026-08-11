import { getCatalog } from "@/lib/catalog";
import { HomePageContent } from "@/components/HomePageContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [menu, shop] = await Promise.all([getCatalog("menu"), getCatalog("shop")]);
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
