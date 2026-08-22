import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCommerceEnvironment } from "@/lib/runtime-environment";
import {
  forecastInventoryUnit,
  inventoryForecastSignalRank,
  INVENTORY_FORECAST_PERIODS,
  INVENTORY_TARGET_COVERAGE_DAYS,
  type InventoryForecastInput,
  type InventoryForecastPeriod,
} from "@/lib/inventory-forecast";

type AnyRow = Record<string, any>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return text(value).toLocaleLowerCase("fr-FR");
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isBoutique(order: AnyRow) {
  const source = normalized(order.source_channel);
  const type = normalized(order.order_type);
  return (
    source === "shop" ||
    source === "mixed" ||
    (!source && type === "shipping")
  );
}

function isCancelledOrRefunded(order: AnyRow) {
  const status = normalized(order.status);
  const payment = normalized(order.payment_status);
  return (
    payment === "refunded" ||
    [
      "cancelled",
      "canceled",
      "annulée",
      "annulee",
      "refunded",
      "remboursée",
      "remboursee",
    ].includes(status)
  );
}

async function fetchOrders(
  supabase: any,
  from: string,
  to: string,
  environment: "test" | "live",
) {
  const rows: AnyRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id,created_at,status,payment_status,source_channel,order_type,environment,archived_at",
      )
      .eq("environment", environment)
      .eq("payment_status", "paid")
      .is("archived_at", null)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const batch = (data ?? []) as AnyRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows.filter(
    (order) => isBoutique(order) && !isCancelledOrRefunded(order),
  );
}

async function fetchOrderItems(supabase: any, orderIds: string[]) {
  const rows: AnyRow[] = [];
  const chunkSize = 100;

  for (let index = 0; index < orderIds.length; index += chunkSize) {
    const chunk = orderIds.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("order_items")
      .select("order_id,product_id,variant_id,quantity")
      .in("order_id", chunk);

    if (error) throw error;
    rows.push(...((data ?? []) as AnyRow[]));
  }

  return rows;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedDays = Number(url.searchParams.get("days") || 30);
    const days = (
      INVENTORY_FORECAST_PERIODS as readonly number[]
    ).includes(requestedDays)
      ? (requestedDays as InventoryForecastPeriod)
      : 30;

    const { supabase } = await requireAdmin(request);
    const environment = getCommerceEnvironment();
    const now = new Date();
    const from = new Date(
      now.getTime() - days * 24 * 60 * 60 * 1000,
    );

    const { data: shopCategories, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("kind", "shop");

    if (categoryError) throw categoryError;

    const categoryIds = (shopCategories ?? []).map((row: AnyRow) =>
      text(row.id),
    );

    let products: AnyRow[] = [];
    let variants: AnyRow[] = [];

    if (categoryIds.length) {
      const { data: productRows, error: productError } = await supabase
        .from("products")
        .select("id,name_fr,stock,active,category_id")
        .in("category_id", categoryIds)
        .eq("active", true)
        .limit(2000);

      if (productError) throw productError;
      products = (productRows ?? []) as AnyRow[];

      const productIds = products.map((row) => text(row.id)).filter(Boolean);
      if (productIds.length) {
        const { data: variantRows, error: variantError } = await supabase
          .from("product_variants")
          .select("id,product_id,name,sku,stock,active")
          .in("product_id", productIds)
          .eq("active", true)
          .limit(5000);

        if (variantError) throw variantError;
        variants = (variantRows ?? []) as AnyRow[];
      }
    }

    const orders = await fetchOrders(
      supabase,
      from.toISOString(),
      now.toISOString(),
      environment,
    );
    const orderIds = orders.map((order) => text(order.id)).filter(Boolean);
    const orderItems = orderIds.length
      ? await fetchOrderItems(supabase, orderIds)
      : [];

    const productName = new Map<string, string>();
    const activeVariantCount = new Map<string, number>();
    const activeVariantIds = new Set<string>();
    const activeProductIds = new Set<string>();

    for (const product of products) {
      const productId = text(product.id);
      activeProductIds.add(productId);
      productName.set(
        productId,
        text(product.name_fr) || "Produit",
      );
    }

    for (const variant of variants) {
      const productId = text(variant.product_id);
      const variantId = text(variant.id);
      activeVariantIds.add(variantId);
      activeVariantCount.set(
        productId,
        (activeVariantCount.get(productId) ?? 0) + 1,
      );
    }

    const salesByStockUnit = new Map<string, number>();
    let unmappedUnits = 0;

    for (const item of orderItems) {
      const productId = text(item.product_id);
      const variantId = text(item.variant_id);
      const quantity = Math.max(0, numeric(item.quantity));
      if (!quantity) continue;

      if (variantId && activeVariantIds.has(variantId)) {
        const key = `variant:${variantId}`;
        salesByStockUnit.set(
          key,
          (salesByStockUnit.get(key) ?? 0) + quantity,
        );
        continue;
      }

      if (
        productId &&
        activeProductIds.has(productId) &&
        (activeVariantCount.get(productId) ?? 0) === 0
      ) {
        const key = `product:${productId}`;
        salesByStockUnit.set(
          key,
          (salesByStockUnit.get(key) ?? 0) + quantity,
        );
        continue;
      }

      unmappedUnits += quantity;
    }

    const stockUnits: InventoryForecastInput[] = [];

    for (const variant of variants) {
      const variantId = text(variant.id);
      const productId = text(variant.product_id);
      stockUnits.push({
        id: variantId,
        productId,
        variantId,
        kind: "variant",
        name: text(variant.name) || "Variante",
        productName: productName.get(productId) ?? "Produit",
        sku: text(variant.sku) || null,
        stock: numeric(variant.stock),
        unitsSold: salesByStockUnit.get(`variant:${variantId}`) ?? 0,
      });
    }

    // Canonical stock rule: when active variants exist, the base product
    // stock is intentionally ignored because inventory lives on variants.
    for (const product of products) {
      const productId = text(product.id);
      if ((activeVariantCount.get(productId) ?? 0) > 0) continue;

      stockUnits.push({
        id: productId,
        productId,
        variantId: null,
        kind: "product",
        name: productName.get(productId) ?? "Produit",
        productName: null,
        sku: null,
        stock: numeric(product.stock),
        unitsSold: salesByStockUnit.get(`product:${productId}`) ?? 0,
      });
    }

    const rows = stockUnits
      .map((unit) => forecastInventoryUnit(unit, days))
      .sort(
        (a, b) =>
          inventoryForecastSignalRank(a.signal) -
            inventoryForecastSignalRank(b.signal) ||
          (a.coverageDays ?? Number.POSITIVE_INFINITY) -
            (b.coverageDays ?? Number.POSITIVE_INFINITY) ||
          a.stock - b.stock ||
          `${a.productName ?? ""} ${a.name}`.localeCompare(
            `${b.productName ?? ""} ${b.name}`,
            "fr",
          ),
      );

    return NextResponse.json(
      {
        periodDays: days,
        targetCoverageDays: INVENTORY_TARGET_COVERAGE_DAYS,
        generatedAt: now.toISOString(),
        environment,
        summary: {
          stockUnits: rows.length,
          out: rows.filter((row) => row.signal === "out").length,
          urgent: rows.filter((row) => row.signal === "urgent").length,
          order: rows.filter((row) => row.signal === "order").length,
          watch: rows.filter((row) => row.signal === "watch").length,
          healthy: rows.filter((row) => row.signal === "healthy").length,
          noSales: rows.filter((row) => row.signal === "no_sales").length,
          suggestedUnits: rows.reduce(
            (sum, row) => sum + row.suggestedOrder,
            0,
          ),
        },
        rows,
        diagnostics: {
          ordersAnalyzed: orders.length,
          orderItemsAnalyzed: orderItems.length,
          unmappedUnits: Math.round(unmappedUnits * 100) / 100,
        },
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

    console.error("[INVENTORY_FORECAST_ERROR]", error);
    return NextResponse.json(
      {
        error:
          status === 401 || status === 403
            ? "Session administrateur invalide."
            : "Prévision de stock indisponible pour le moment.",
      },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
