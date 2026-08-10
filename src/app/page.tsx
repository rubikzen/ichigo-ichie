import { getCatalog } from "@/lib/catalog";
import { HomePageContent } from "@/components/HomePageContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [menu, shop] = await Promise.all([getCatalog("menu"), getCatalog("shop")]);
  const featured = menu.products.filter((product) => product.featured).slice(0, 4);

  return <HomePageContent
    featured={featured}
    menuCategories={menu.categories}
    menuProducts={menu.products}
    shopCategories={shop.categories}
    shopProducts={shop.products}
  />;
}
