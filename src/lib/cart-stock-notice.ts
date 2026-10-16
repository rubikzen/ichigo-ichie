export type CartStockLanguage = "fr" | "en";

/**
 * Cart stock text is intentionally hidden when there are at least five
 * units left. Stock/quantity validation stays independent of this message.
 */
export function cartStockNotice(
  stock: number | null,
  stockConflict: boolean,
  language: CartStockLanguage,
): string | null {
  if (stock === null || !Number.isFinite(stock)) return null;
  if (stock <= 0) return language === "fr" ? "Rupture de stock" : "Sold out";
  if (stockConflict) {
    if (stock < 5) {
      return language === "fr"
        ? `Plus que ${stock} en stock · Quantité demandée trop élevée`
        : `Only ${stock} left · Requested quantity too high`;
    }
    return language === "fr"
      ? "Quantité demandée supérieure au stock disponible"
      : "Requested quantity exceeds available stock";
  }
  if (stock < 5) {
    return language === "fr" ? `Plus que ${stock} en stock` : `Only ${stock} left`;
  }
  return null;
}
