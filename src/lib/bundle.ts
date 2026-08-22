import type { CartItem, Product, Variant } from "@/lib/types";

export const RITUAL_BUNDLE_ID = "rituel-matcha-accessoire-v465";
export const RITUAL_BUNDLE_RATE = 0.05;

export function availableBundleVariants(product: Product) {
  return product.variants.filter(
    (variant) => variant.active && Number(variant.stock) > 0,
  );
}

export function firstAvailableBundleVariant(product: Product): Variant | null {
  return availableBundleVariants(product)[0] ?? null;
}

export function bundleProductStock(
  product: Product,
  variant?: Variant | null,
) {
  return Number(variant?.stock ?? product.stock ?? 0);
}

export function bundleProductPrice(
  product: Product,
  variant?: Variant | null,
) {
  return Number(variant?.price ?? product.base_price ?? 0);
}

export function isRitualBundleCandidate(product: Product) {
  if (
    !product.active ||
    (product.type !== "product" && product.type !== "accessory")
  ) {
    return false;
  }

  const hasRequiredOptions = product.option_groups.some(
    (group) => group.required || Number(group.min_select) > 0,
  );
  if (hasRequiredOptions) return false;

  const variants = product.variants.filter((variant) => variant.active);
  return variants.length
    ? variants.some((variant) => Number(variant.stock) > 0)
    : Number(product.stock) > 0;
}

export function bundleCartKey(
  productId: string,
  variantId: string | null | undefined,
  groupId: string,
) {
  return `${productId}|${variantId ?? "base"}|bundle:${groupId}`;
}

export function cartBundleDiscount(
  items: Array<
    Pick<
      CartItem,
      "bundleId" | "bundleGroupId" | "quantity" | "unitPrice"
    >
  >,
) {
  const groups = new Map<string, typeof items>();

  for (const item of items) {
    if (item.bundleId !== RITUAL_BUNDLE_ID || !item.bundleGroupId) continue;
    groups.set(item.bundleGroupId, [
      ...(groups.get(item.bundleGroupId) ?? []),
      item,
    ]);
  }

  let discount = 0;
  for (const rows of groups.values()) {
    if (rows.length !== 2) continue;
    if (rows[0].quantity < 1 || rows[0].quantity !== rows[1].quantity) continue;

    const groupSubtotal = rows.reduce(
      (sum, row) => sum + row.unitPrice * row.quantity,
      0,
    );
    discount += groupSubtotal * RITUAL_BUNDLE_RATE;
  }

  return Math.round(discount * 100) / 100;
}
