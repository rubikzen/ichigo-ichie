import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildCommercialLaunchReport } from "@/lib/commercial-launch";
import { siteSettingDefaults } from "@/lib/settings";
import type { Product, Variant } from "@/lib/types";

type AnyRow = Record<string, any>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);

    const { data: categoryRows, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("kind", "shop");

    if (categoryError) throw categoryError;
    const categoryIds = (categoryRows ?? []).map((row) => String(row.id));

    let productRows: AnyRow[] = [];
    if (categoryIds.length) {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,slug,category_id,type,name_fr,name_en,description_fr,description_en,long_description_fr,long_description_en,origin,cultivar,badge,base_price,stock,pickup_only,active,featured,sort_order,image_url,ideal_for,food_info",
        )
        .in("category_id", categoryIds)
        .eq("active", true)
        .limit(2000);
      if (error) throw error;
      productRows = (data ?? []) as AnyRow[];
    }

    const productIds = productRows.map((row) => text(row.id)).filter(Boolean);
    let variants: Variant[] = [];
    const imageCount = new Map<string, number>();

    if (productIds.length) {
      const [variantResult, imageResult] = await Promise.all([
        supabase
          .from("product_variants")
          .select(
            "id,product_id,name,packaging,weight,price,stock,sku,active,image_url,shipping_weight_g",
          )
          .in("product_id", productIds)
          .eq("active", true)
          .limit(5000),
        supabase
          .from("product_images")
          .select("product_id")
          .in("product_id", productIds)
          .limit(5000),
      ]);

      if (variantResult.error) throw variantResult.error;
      if (imageResult.error) throw imageResult.error;
      variants = (variantResult.data ?? []) as Variant[];

      for (const row of imageResult.data ?? []) {
        const id = text(row.product_id);
        imageCount.set(id, (imageCount.get(id) ?? 0) + 1);
      }
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
      food_info:
        row.food_info && typeof row.food_info === "object"
          ? row.food_info
          : {},
      images: Array.from(
        { length: imageCount.get(text(row.id)) ?? 0 },
        (_, index) => ({
          id: `${row.id}-${index}`,
          product_id: text(row.id),
          url: "stored",
          sort_order: index,
        }),
      ),
      variants: variants.filter(
        (variant) => variant.product_id === text(row.id),
      ),
      option_groups: [],
    }));

    const settingKeys = [
      "legal_notice_body_fr",
      "terms_body_fr",
      "privacy_body_fr",
      "shipping_returns_body_fr",
      "support_email",
    ];

    const { data: settingRows, error: settingError } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", settingKeys);

    if (settingError) throw settingError;

    const settings = {
      ...siteSettingDefaults,
      ...Object.fromEntries(
        (settingRows ?? []).map((row) => [
          text(row.key),
          text(row.value),
        ]),
      ),
    };

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        ...buildCommercialLaunchReport({
          products,
          variants,
          settings,
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? Number((error as { status: number }).status)
        : 500;

    console.error("[COMMERCIAL_LAUNCH_V483_ERROR]", error);

    return NextResponse.json(
      {
        error:
          status === 401 || status === 403
            ? "Session administrateur invalide."
            : "Contrôle de lancement indisponible.",
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
