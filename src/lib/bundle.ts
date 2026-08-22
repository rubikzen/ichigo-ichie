import type { CartItem, Product, Variant } from "@/lib/types";

export const RITUAL_BUNDLE_ID = "rituel-matcha-accessoire-v465";
export const RITUAL_BUNDLE_RATE = 0.05;
export const MAX_RITUAL_BUNDLE_PERCENT = 50;

export type RitualBundleMode = "matcha_accessory" | "two_matcha";

export function ritualBundleModeFromSetting(
  value: string | undefined | null,
): RitualBundleMode {
  return value === "two_matcha" ? "two_matcha" : "matcha_accessory";
}

export function ritualBundlePercentFromSetting(
  value: string | number | undefined | null,
) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return RITUAL_BUNDLE_RATE * 100;
  return Math.min(
    MAX_RITUAL_BUNDLE_PERCENT,
    Math.max(0, Math.round(parsed * 100) / 100),
  );
}

export function ritualBundleRateFromSetting(
  value: string | number | undefined | null,
) {
  return ritualBundlePercentFromSetting(value) / 100;
}

export function ritualBundlePercentLabel(
  percent: number,
  language: "fr" | "en",
) {
  const rounded = Math.round(percent * 100) / 100;
  const text = String(rounded);
  return language === "fr" ? text.replace(".", ",") : text;
}

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
  slot?: "a" | "b",
) {
  return `${productId}|${variantId ?? "base"}|bundle:${groupId}${
    slot ? `:slot:${slot}` : ""
  }`;
}

export function cartBundleDiscount(
  items: Array<
    Pick<
      CartItem,
      "bundleId" | "bundleGroupId" | "quantity" | "unitPrice"
    >
  >,
  rate = RITUAL_BUNDLE_RATE,
) {
  const safeRate = Math.min(
    MAX_RITUAL_BUNDLE_PERCENT / 100,
    Math.max(0, Number(rate) || 0),
  );
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
    discount += groupSubtotal * safeRate;
  }

  return Math.round(discount * 100) / 100;
}
