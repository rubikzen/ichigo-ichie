import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  buildSeoHealthReport,
  type SeoHealthReviewTotals,
} from "@/lib/seo-health";
import { siteSettingDefaults } from "@/lib/settings";
import type {
  Category,
  Product,
  ProductImage,
  Variant,
} from "@/lib/types";

type AnyRow = Record<string, any>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);

    const { data: categoryRows, error: categoryError } = await supabase
      .from("categories")
      .select("id,slug,name_fr,name_en,kind,sort_order,active")
      .eq("kind", "shop")
      .eq("active", true)
      .order("sort_order");

    if (categoryError) throw categoryError;

    const categories = (categoryRows ?? []) as Category[];
    const categoryIds = categories.map((category) => category.id);

    let productRows: AnyRow[] = [];
    if (categoryIds.length) {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,slug,category_id,type,name_fr,name_en,description_fr,description_en,long_description_fr,long_description_en,origin,cultivar,badge,base_price,stock,pickup_only,active,featured,sort_order,image_url,ideal_for",
        )
        .in("category_id", categoryIds)
        .eq("active", true)
        .order("sort_order")
        .limit(2000);

      if (error) throw error;
      productRows = (data ?? []) as AnyRow[];
    }

    const productIds = productRows
      .map((product) => text(product.id))
      .filter(Boolean);

    let imageRows: ProductImage[] = [];
    let variantRows: Variant[] = [];
    let approvedReviewRows: AnyRow[] = [];

    if (productIds.length) {
      const [imagesResult, variantsResult, reviewsResult] =
        await Promise.all([
          supabase
            .from("product_images")
            .select("id,product_id,url,sort_order")
            .in("product_id", productIds)
            .order("sort_order")
            .limit(5000),
          supabase
            .from("product_variants")
            .select(
              "id,product_id,name,packaging,weight,price,stock,sku,active,image_url,shipping_weight_g",
            )
            .in("product_id", productIds)
            .eq("active", true)
            .limit(5000),
          supabase
            .from("product_reviews")
            .select("product_id,rating")
            .in("product_id", productIds)
            .eq("status", "approved")
            .limit(10000),
        ]);

      if (imagesResult.error) throw imagesResult.error;
      if (variantsResult.error) throw variantsResult.error;
      if (reviewsResult.error) throw reviewsResult.error;

      imageRows = (imagesResult.data ?? []) as ProductImage[];
      variantRows = (variantsResult.data ?? []) as Variant[];
      approvedReviewRows = (reviewsResult.data ?? []) as AnyRow[];
    }

    const { data: settingRows, error: settingsError } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", [
        "seo_title",
        "seo_description",
        "store_address",
        "opening_hours",
        "shop_reviews_enabled",
        "shop_reviews_show_rating",
      ]);

    if (settingsError) throw settingsError;

    const settings = {
      ...siteSettingDefaults,
      ...Object.fromEntries(
        (settingRows ?? []).map((row: AnyRow) => [
          text(row.key),
          text(row.value),
        ]),
      ),
    };

    const imagesByProduct = new Map<string, ProductImage[]>();
    for (const image of imageRows) {
      imagesByProduct.set(image.product_id, [
        ...(imagesByProduct.get(image.product_id) ?? []),
        image,
      ]);
    }

    const variantsByProduct = new Map<string, Variant[]>();
    for (const variant of variantRows) {
      variantsByProduct.set(variant.product_id, [
        ...(variantsByProduct.get(variant.product_id) ?? []),
        variant,
      ]);
    }

    const products: Product[] = productRows.map((row) => ({
      id: text(row.id),
      slug: text(row.slug),
      category_id: text(row.category_id),
      type: row.type as Product["type"],
      name_fr: text(row.name_fr),
      name_en: text(row.name_en),
      description_fr: text(row.description_fr),
      description_en: text(row.description_en),
      long_description_fr: text(row.long_description_fr) || null,
      long_description_en: text(row.long_description_en) || null,
      origin: text(row.origin) || null,
      cultivar: text(row.cultivar) || null,
      badge: text(row.badge) || null,
      base_price: Number(row.base_price ?? 0),
      stock: Number(row.stock ?? 0),
      pickup_only: Boolean(row.pickup_only),
      active: row.active !== false,
      featured: Boolean(row.featured),
      sort_order: Number(row.sort_order ?? 0),
      image_url: text(row.image_url) || null,
      ideal_for: Array.isArray(row.ideal_for)
        ? row.ideal_for.map((value: unknown) => text(value)).filter(Boolean)
        : [],
      images: imagesByProduct.get(text(row.id)) ?? [],
      variants: variantsByProduct.get(text(row.id)) ?? [],
      option_groups: [],
    }));

    const reviewTotals: SeoHealthReviewTotals = {};
    for (const row of approvedReviewRows) {
      const productId = text(row.product_id);
      const rating = Number(row.rating);
      if (!productId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        continue;
      }
      const current = reviewTotals[productId] ?? {
        count: 0,
        total: 0,
      };
      current.count += 1;
      current.total += rating;
      reviewTotals[productId] = current;
    }

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        ...buildSeoHealthReport({
          products,
          categories,
          reviewTotals,
          settings,
        }),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? Number((error as { status: number }).status)
        : 500;

    console.error("[SEO_HEALTH_V475_ERROR]", error);

    return NextResponse.json(
      {
        error:
          status === 401 || status === 403
            ? "Session administrateur invalide."
            : "Audit SEO indisponible pour le moment.",
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
