import { createClient } from "@supabase/supabase-js";
import { seedCategories, seedProducts } from "./seed";
import type { Category, OptionGroup, Product, ProductImage, Variant } from "./types";

export type CatalogKind = "menu" | "shop";

export async function getCatalog(kind?: CatalogKind): Promise<{ categories: Category[]; products: Product[]; demo: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const categories = kind ? seedCategories.filter((c) => c.kind === kind) : seedCategories;
    const allowedIds = new Set(categories.map((c) => c.id));
    return { categories, products: seedProducts.filter((p) => p.active && allowedIds.has(p.category_id)), demo: true };
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  let categoryQuery = supabase.from("categories").select("*").eq("active", true).order("sort_order");
  if (kind) categoryQuery = categoryQuery.eq("kind", kind);

  const { data: categoriesData, error: categoryError } = await categoryQuery;
  if (categoryError) throw categoryError;
  const categories = (categoriesData ?? []) as Category[];
  const categoryIds = categories.map((c) => c.id);
  if (!categoryIds.length) return { categories, products: [], demo: false };

  const { data: productsData, error: productError } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .in("category_id", categoryIds)
    .order("sort_order");
  if (productError) throw productError;

  const baseProducts = (productsData ?? []) as Omit<Product, "variants" | "option_groups">[];
  const productIds = baseProducts.map((p) => p.id);
  if (!productIds.length) return { categories, products: [], demo: false };

  const [{ data: variantsData }, { data: joinsData }, { data: imagesData }] = await Promise.all([
    supabase.from("product_variants").select("*").in("product_id", productIds).eq("active", true).order("sort_order"),
    supabase.from("product_option_groups").select("product_id, option_group_id, sort_order").in("product_id", productIds).order("sort_order"),
    supabase.from("product_images").select("*").in("product_id", productIds).order("sort_order"),
  ]);

  const optionGroupIds = [...new Set((joinsData ?? []).map((j: { option_group_id: string }) => j.option_group_id))];
  let groupsData: Array<Record<string, unknown>> = [];
  let valuesData: Array<Record<string, unknown>> = [];
  if (optionGroupIds.length) {
    const [groupsRes, valuesRes] = await Promise.all([
      supabase.from("option_groups").select("*").in("id", optionGroupIds),
      supabase.from("option_values").select("*").in("option_group_id", optionGroupIds).eq("active", true).order("sort_order"),
    ]);
    groupsData = groupsRes.data ?? [];
    valuesData = valuesRes.data ?? [];
  }

  const variantsByProduct = new Map<string, Variant[]>();
  for (const row of variantsData ?? []) {
    const variant = row as Variant;
    variantsByProduct.set(variant.product_id, [...(variantsByProduct.get(variant.product_id) ?? []), variant]);
  }

  const imagesByProduct = new Map<string, ProductImage[]>();
  for (const row of imagesData ?? []) {
    const image = row as ProductImage;
    imagesByProduct.set(image.product_id, [...(imagesByProduct.get(image.product_id) ?? []), image]);
  }

  const groupMap = new Map<string, OptionGroup>();
  for (const raw of groupsData) {
    const id = String(raw.id);
    groupMap.set(id, {
      id,
      name_fr: String(raw.name_fr ?? ""),
      name_en: String(raw.name_en ?? ""),
      required: Boolean(raw.required),
      min_select: Number(raw.min_select ?? 0),
      max_select: Number(raw.max_select ?? 1),
      values: valuesData
        .filter((v) => v.option_group_id === id)
        .map((v) => ({
          id: String(v.id),
          label_fr: String(v.label_fr ?? ""),
          label_en: String(v.label_en ?? ""),
          price_delta: Number(v.price_delta ?? 0),
          sort_order: Number(v.sort_order ?? 0),
        })),
    });
  }

  const groupsByProduct = new Map<string, OptionGroup[]>();
  for (const join of joinsData ?? []) {
    const group = groupMap.get(join.option_group_id as string);
    if (!group) continue;
    const pid = join.product_id as string;
    groupsByProduct.set(pid, [...(groupsByProduct.get(pid) ?? []), group]);
  }

  const products: Product[] = baseProducts.map((p) => ({
    ...p,
    ideal_for: Array.isArray(p.ideal_for) ? p.ideal_for : [],
    images: imagesByProduct.get(p.id) ?? [],
    variants: variantsByProduct.get(p.id) ?? [],
    option_groups: groupsByProduct.get(p.id) ?? [],
  }));

  return { categories, products, demo: false };
}
