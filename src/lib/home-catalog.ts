import type { Product, ProductImage } from "@/lib/types";

function firstSortedImage(images: ProductImage[] | undefined) {
  if (!images?.length) return [];
  let first = images[0];
  for (const image of images) {
    if (image.sort_order < first.sort_order) first = image;
  }
  return [first];
}

/**
 * The homepage menu only renders compact information cards. Sending the full
 * commerce shape (variants, option groups, food information, long copy and
 * every gallery image) through the RSC payload makes hydration heavier without
 * changing what the visitor can see.
 *
 * Keep the Product shape so existing menu-card code stays unchanged, while
 * deliberately stripping fields that the homepage menu never reads.
 */
export function compactMenuProductForHome(product: Product): Product {
  return {
    id: product.id,
    slug: product.slug,
    category_id: product.category_id,
    type: product.type,
    name_fr: product.name_fr,
    name_en: product.name_en,
    description_fr: product.description_fr,
    description_en: product.description_en,
    badge: product.badge,
    base_price: product.base_price,
    stock: product.stock,
    pickup_only: product.pickup_only,
    active: product.active,
    featured: product.featured,
    sort_order: product.sort_order,
    image_url: product.image_url,
    images: firstSortedImage(product.images),
    ideal_for: [],
    variants: [],
    option_groups: [],
  };
}

/**
 * Shop cards on the homepage need real variants, options and the complete
 * gallery because they support quick add, the product modal and ritual bundle.
 * They do not use regulatory food copy or backend-only variant metadata.
 * Removing those fields keeps the storefront behaviour identical while
 * reducing the server-component payload sent to every homepage visitor.
 */
export function compactShopProductForHome(product: Product): Product {
  return {
    id: product.id,
    slug: product.slug,
    category_id: product.category_id,
    type: product.type,
    name_fr: product.name_fr,
    name_en: product.name_en,
    description_fr: product.description_fr,
    description_en: product.description_en,
    long_description_fr: product.long_description_fr,
    long_description_en: product.long_description_en,
    origin: product.origin,
    cultivar: product.cultivar,
    badge: product.badge,
    base_price: product.base_price,
    stock: product.stock,
    pickup_only: product.pickup_only,
    active: product.active,
    featured: product.featured,
    sort_order: product.sort_order,
    image_url: product.image_url,
    images: product.images,
    ideal_for: product.ideal_for,
    food_info: null,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      product_id: variant.product_id,
      name: variant.name,
      packaging: variant.packaging,
      weight: variant.weight,
      price: variant.price,
      stock: variant.stock,
      active: variant.active,
    })),
    option_groups: product.option_groups,
  };
}
