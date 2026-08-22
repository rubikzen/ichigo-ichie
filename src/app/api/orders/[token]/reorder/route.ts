import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { composeProductVariantName } from "@/lib/product-label";
import {
  consumeRateLimit,
  tooManyRequests,
} from "@/lib/public-api";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnyRow = Record<string, any>;

type PreparedChoice = {
  groupId: string;
  groupNameFr: string;
  groupNameEn: string;
  valueId: string;
  valueNameFr: string;
  valueNameEn: string;
  priceDelta: number;
};

type PreparedItem = {
  historicalItemId: string;
  productId: string;
  variantId: string | null;
  stockUnitKey: string;
  key: string;
  requestedQuantity: number;
  availableStock: number;
  nameFr: string;
  nameEn: string;
  imageUrl: string | null;
  unitPrice: number;
  pickupOnly: boolean;
  productUrl: string;
  choices: PreparedChoice[];
};

type ReorderIssueReason =
  | "legacy_item"
  | "product_unavailable"
  | "out_of_stock"
  | "configuration_changed";

type ReorderIssue = {
  historicalItemId: string;
  productName: string;
  quantity: number;
  reason: ReorderIssueReason;
  productUrl: string | null;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function terminalOrder(order: AnyRow) {
  return (
    ["completed", "cancelled", "refunded"].includes(
      text(order.status).toLowerCase(),
    ) ||
    text(order.payment_status).toLowerCase() === "refunded"
  );
}

function historicalChoices(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const choice = row as Record<string, unknown>;
      const groupId = text(choice.groupId);
      const valueId = text(choice.valueId);
      if (!groupId || !valueId) return null;
      return { groupId, valueId };
    })
    .filter(
      (
        row,
      ): row is {
        groupId: string;
        valueId: string;
      } => Boolean(row),
    );
}

function issue(
  item: AnyRow,
  reason: ReorderIssueReason,
  productUrl: string | null = null,
): ReorderIssue {
  return {
    historicalItemId: text(item.id),
    productName: text(item.product_name) || "Produit",
    quantity: Math.max(1, Math.floor(number(item.quantity) || 1)),
    reason,
    productUrl,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!UUID_RE.test(token)) {
      return NextResponse.json(
        {
          error: "Commande introuvable.",
          code: "REORDER_NOT_FOUND",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        {
          error: "Service momentanément indisponible.",
          code: "REORDER_UNAVAILABLE",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "orders:reorder:v468",
      limit: 20,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
          id,
          order_number,
          status,
          payment_status,
          promo_code,
          discount_amount,
          order_items(
            id,
            product_id,
            variant_id,
            product_name,
            quantity,
            choices
          )
        `,
      )
      .eq("public_token", token)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      return NextResponse.json(
        {
          error: "Commande introuvable.",
          code: "REORDER_NOT_FOUND",
        },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!terminalOrder(order)) {
      return NextResponse.json(
        {
          error:
            "Cette commande est encore active. Utilisez son suivi ou son paiement existant.",
          code: "REORDER_ORDER_ACTIVE",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const historicalItems = ((order.order_items ?? []) as AnyRow[]).slice(
      0,
      30,
    );
    const productIds = [
      ...new Set(
        historicalItems
          .map((item) => text(item.product_id))
          .filter(Boolean),
      ),
    ];

    if (!productIds.length) {
      return NextResponse.json(
        {
          orderNumber: text(order.order_number),
          items: [],
          issues: historicalItems.map((item) =>
            issue(item, "legacy_item"),
          ),
          previousPromotionIgnored: Boolean(
            text(order.promo_code) || number(order.discount_amount) > 0,
          ),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const [
      { data: productRows, error: productError },
      { data: variantRows, error: variantError },
      { data: joinRows, error: joinError },
    ] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id,slug,category_id,name_fr,name_en,base_price,stock,pickup_only,active,image_url",
        )
        .in("id", productIds),
      supabase
        .from("product_variants")
        .select(
          "id,product_id,name,packaging,weight,price,stock,active,image_url",
        )
        .in("product_id", productIds),
      supabase
        .from("product_option_groups")
        .select("product_id,option_group_id,sort_order")
        .in("product_id", productIds),
    ]);

    if (productError) throw productError;
    if (variantError) throw variantError;
    if (joinError) throw joinError;

    const products = (productRows ?? []) as AnyRow[];
    const variants = (variantRows ?? []) as AnyRow[];
    const joins = (joinRows ?? []) as AnyRow[];

    const categoryIds = [
      ...new Set(products.map((row) => text(row.category_id)).filter(Boolean)),
    ];
    const groupIds = [
      ...new Set(joins.map((row) => text(row.option_group_id)).filter(Boolean)),
    ];

    const [
      { data: categoryRows, error: categoryError },
      { data: groupRows, error: groupError },
      { data: valueRows, error: valueError },
    ] = await Promise.all([
      categoryIds.length
        ? supabase
            .from("categories")
            .select("id,kind")
            .in("id", categoryIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabase
            .from("option_groups")
            .select(
              "id,name_fr,name_en,required,min_select,max_select",
            )
            .in("id", groupIds)
        : Promise.resolve({ data: [], error: null }),
      groupIds.length
        ? supabase
            .from("option_values")
            .select(
              "id,option_group_id,label_fr,label_en,price_delta,active",
            )
            .in("option_group_id", groupIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (categoryError) throw categoryError;
    if (groupError) throw groupError;
    if (valueError) throw valueError;

    const categoryKind = new Map(
      ((categoryRows ?? []) as AnyRow[]).map((row) => [
        text(row.id),
        text(row.kind),
      ]),
    );
    const productById = new Map(
      products.map((row) => [text(row.id), row]),
    );

    const variantsByProduct = new Map<string, AnyRow[]>();
    for (const variant of variants) {
      const productId = text(variant.product_id);
      variantsByProduct.set(productId, [
        ...(variantsByProduct.get(productId) ?? []),
        variant,
      ]);
    }

    const groupById = new Map(
      ((groupRows ?? []) as AnyRow[]).map((row) => [
        text(row.id),
        row,
      ]),
    );
    const valueById = new Map(
      ((valueRows ?? []) as AnyRow[]).map((row) => [
        text(row.id),
        row,
      ]),
    );

    const groupsByProduct = new Map<string, AnyRow[]>();
    for (const join of joins) {
      const productId = text(join.product_id);
      const group = groupById.get(text(join.option_group_id));
      if (!group) continue;
      groupsByProduct.set(productId, [
        ...(groupsByProduct.get(productId) ?? []),
        {
          ...group,
          sort_order: number(join.sort_order),
        },
      ]);
    }

    for (const groups of groupsByProduct.values()) {
      groups.sort(
        (a, b) =>
          number(a.sort_order) - number(b.sort_order) ||
          text(a.id).localeCompare(text(b.id)),
      );
    }

    const preparedByKey = new Map<string, PreparedItem>();
    const issues: ReorderIssue[] = [];

    for (const historical of historicalItems) {
      const productId = text(historical.product_id);
      const product = productById.get(productId);

      if (!productId) {
        issues.push(issue(historical, "legacy_item"));
        continue;
      }

      const productUrl =
        product && text(product.slug)
          ? `/boutique/${encodeURIComponent(text(product.slug).toLowerCase())}`
          : null;

      if (
        !product ||
        !product.active ||
        categoryKind.get(text(product.category_id)) !== "shop"
      ) {
        issues.push(
          issue(historical, "product_unavailable", null),
        );
        continue;
      }

      const currentVariants = (variantsByProduct.get(productId) ?? []).filter(
        (variant) => Boolean(variant.active),
      );
      const historicalVariantId = text(historical.variant_id);
      let variant: AnyRow | null = null;

      if (currentVariants.length) {
        if (!historicalVariantId) {
          issues.push(
            issue(historical, "configuration_changed", productUrl),
          );
          continue;
        }
        variant =
          currentVariants.find(
            (row) => text(row.id) === historicalVariantId,
          ) ?? null;
        if (!variant) {
          issues.push(
            issue(historical, "configuration_changed", productUrl),
          );
          continue;
        }
      } else if (historicalVariantId) {
        issues.push(
          issue(historical, "configuration_changed", productUrl),
        );
        continue;
      }

      const currentGroups = groupsByProduct.get(productId) ?? [];
      const selectedHistory = historicalChoices(historical.choices);
      const selectedByGroup = new Map<string, string[]>();

      for (const selected of selectedHistory) {
        selectedByGroup.set(selected.groupId, [
          ...(selectedByGroup.get(selected.groupId) ?? []),
          selected.valueId,
        ]);
      }

      const allowedGroupIds = new Set(
        currentGroups.map((group) => text(group.id)),
      );

      if (
        selectedHistory.some(
          (selected) => !allowedGroupIds.has(selected.groupId),
        )
      ) {
        issues.push(
          issue(historical, "configuration_changed", productUrl),
        );
        continue;
      }

      let configurationChanged = false;
      const choices: PreparedChoice[] = [];

      for (const group of currentGroups) {
        const groupId = text(group.id);
        const valueIds = selectedByGroup.get(groupId) ?? [];
        const minimum = Boolean(group.required)
          ? Math.max(1, number(group.min_select))
          : Math.max(0, number(group.min_select));
        const maximum = Math.max(1, number(group.max_select) || 1);

        if (valueIds.length < minimum || valueIds.length > maximum) {
          configurationChanged = true;
          break;
        }

        const uniqueIds = new Set<string>();
        for (const valueId of valueIds) {
          if (uniqueIds.has(valueId)) {
            configurationChanged = true;
            break;
          }
          uniqueIds.add(valueId);

          const value = valueById.get(valueId);
          if (
            !value ||
            !value.active ||
            text(value.option_group_id) !== groupId
          ) {
            configurationChanged = true;
            break;
          }

          choices.push({
            groupId,
            groupNameFr: text(group.name_fr),
            groupNameEn: text(group.name_en) || text(group.name_fr),
            valueId,
            valueNameFr: text(value.label_fr),
            valueNameEn: text(value.label_en) || text(value.label_fr),
            priceDelta: number(value.price_delta),
          });
        }

        if (configurationChanged) break;
      }

      if (
        !currentGroups.length &&
        Array.isArray(historical.choices) &&
        historical.choices.length > 0
      ) {
        configurationChanged = true;
      }

      if (configurationChanged) {
        issues.push(
          issue(historical, "configuration_changed", productUrl),
        );
        continue;
      }

      const requestedQuantity = Math.min(
        20,
        Math.max(1, Math.floor(number(historical.quantity) || 1)),
      );
      const availableStock = Math.max(
        0,
        Math.floor(number(variant ? variant.stock : product.stock)),
      );

      if (availableStock <= 0) {
        issues.push(
          issue(historical, "out_of_stock", productUrl),
        );
        continue;
      }

      const variantId = variant ? text(variant.id) : null;
      const key = [
        productId,
        variantId ?? "base",
        ...choices
          .map((choice) => `${choice.groupId}:${choice.valueId}`)
          .sort(),
      ].join("|");

      const stockUnitKey = `${productId}|${variantId ?? "base"}`;
      const basePrice = number(variant ? variant.price : product.base_price);
      const unitPrice =
        Math.round(
          (basePrice +
            choices.reduce(
              (sum, choice) => sum + choice.priceDelta,
              0,
            )) *
            100,
        ) / 100;

      const prepared: PreparedItem = {
        historicalItemId: text(historical.id),
        productId,
        variantId,
        stockUnitKey,
        key,
        requestedQuantity,
        availableStock,
        nameFr: composeProductVariantName(
          text(product.name_fr),
          variant,
          "fr",
        ),
        nameEn: composeProductVariantName(
          text(product.name_en) || text(product.name_fr),
          variant,
          "en",
        ),
        imageUrl:
          text(variant?.image_url) ||
          text(product.image_url) ||
          null,
        unitPrice,
        pickupOnly: Boolean(product.pickup_only),
        productUrl: productUrl ?? "/#boutique",
        choices,
      };

      const existing = preparedByKey.get(key);
      if (existing) {
        existing.requestedQuantity = Math.min(
          20,
          existing.requestedQuantity + requestedQuantity,
        );
      } else {
        preparedByKey.set(key, prepared);
      }
    }

    return NextResponse.json(
      {
        orderNumber: text(order.order_number),
        items: [...preparedByKey.values()],
        issues,
        previousPromotionIgnored: Boolean(
          text(order.promo_code) || number(order.discount_amount) > 0,
        ),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[REORDER_V468_ERROR]", error);
    return NextResponse.json(
      {
        error: "Impossible de préparer cette nouvelle commande.",
        code: "REORDER_FAILED",
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
