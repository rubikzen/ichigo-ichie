import type { Product } from "@/lib/types";

type ProductUrlInput = Pick<Product, "id" | "slug" | "name_fr" | "name_en">;

const LEGACY_PRODUCT_SLUG_SEGMENT =
  /(^|[-_])(test|copie|copy)(?=$|[-_])/i;

export function normalizeProductSlug(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function slugifyProductName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function storedProductSlugNeedsCanonical(
  product: ProductUrlInput,
) {
  return LEGACY_PRODUCT_SLUG_SEGMENT.test(
    normalizeProductSlug(product.slug),
  );
}

export function productPublicSlug(product: ProductUrlInput) {
  const stored = normalizeProductSlug(product.slug);
  const nameSlug =
    slugifyProductName(product.name_fr) ||
    slugifyProductName(product.name_en);

  if (stored && !storedProductSlugNeedsCanonical(product)) {
    return stored;
  }

  if (nameSlug) return nameSlug;
  if (stored) return stored;

  const id = normalizeProductSlug(product.id).replace(/[^a-z0-9]/g, "");
  return `produit-${id.slice(0, 8) || "matcha"}`;
}

export function productPublicPath(product: ProductUrlInput) {
  return `/boutique/${encodeURIComponent(productPublicSlug(product))}`;
}
