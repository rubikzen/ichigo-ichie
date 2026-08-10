import { CartPageClient } from "@/components/CartPageClient";
import { getCatalog } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CartPage() {
  const [menu, shop] = await Promise.all([getCatalog("menu"), getCatalog("shop")]);
  const products = [...menu.products, ...shop.products];
  return <CartPageClient products={products} />;
}
