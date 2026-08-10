import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCommerceEnvironment } from "@/lib/runtime-environment";

type AnyRow = Record<string, any>;

const parisDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalized(value: unknown) {
  return text(value).toLocaleLowerCase("fr-FR");
}

function parisDay(value: string) {
  const parts = parisDayFormatter.formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function isBoutique(order: AnyRow) {
  const source = normalized(order.source_channel);
  const type = normalized(order.order_type);
  return source === "shop" || source === "mixed" || (!source && type === "shipping");
}

function isCancelledOrRefunded(order: AnyRow) {
  const status = normalized(order.status);
  return ["cancelled", "canceled", "annulée", "annulee", "refunded", "remboursée", "remboursee"].includes(status);
}

function isPaid(order: AnyRow) {
  return normalized(order.payment_status) === "paid" && !isCancelledOrRefunded(order);
}

function isRefunded(order: AnyRow) {
  const payment = normalized(order.payment_status);
  const status = normalized(order.status);
  return payment === "refunded" || ["refunded", "remboursée", "remboursee"].includes(status);
}

function makeReference() {
  return `STATS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function technicalError(error: unknown) {
  if (!error || typeof error !== "object") return { message: String(error || "Unknown error") };
  const value = error as Record<string, unknown>;
  return {
    message: text(value.message) || "Erreur Supabase inconnue",
    code: text(value.code),
    details: text(value.details),
    hint: text(value.hint),
  };
}

async function fetchOrders(supabase: any, from: string, to: string, environment: "test" | "live") {
  const pageSize = 1000;
  const rows: AnyRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    // select(*) deliberately keeps statistics compatible with older databases.
    // Missing optional promo/tracking columns therefore cannot break the dashboard.
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("environment", environment)
      .is("archived_at", null)
      .gte("created_at", from)
      .lt("created_at", to)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw Object.assign(error, { statsStage: "orders" });
    const batch = (data ?? []) as AnyRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function fetchOrderItems(supabase: any, orderIds: string[]) {
  if (!orderIds.length) return new Map<string, AnyRow[]>();
  const map = new Map<string, AnyRow[]>();
  const chunkSize = 100;

  for (let index = 0; index < orderIds.length; index += chunkSize) {
    const chunk = orderIds.slice(index, index + chunkSize);
    // Same compatibility strategy: select(*) rather than relying on a nested
    // PostgREST relationship or on a specific historical item schema.
    const { data, error } = await supabase.from("order_items").select("*").in("order_id", chunk);
    if (error) {
      // Product ranking is useful but must never make the entire CA dashboard fail.
      console.warn("[ORDER_STATS_ITEMS_WARNING]", technicalError(error));
      continue;
    }
    for (const row of (data ?? []) as AnyRow[]) {
      const orderId = text(row.order_id);
      if (!orderId) continue;
      const current = map.get(orderId) ?? [];
      current.push(row);
      map.set(orderId, current);
    }
  }
  return map;
}

export async function GET(request: Request) {
  const reference = makeReference();
  try {
    const url = new URL(request.url);
    const fromRaw = url.searchParams.get("from") || "";
    const toRaw = url.searchParams.get("to") || "";
    const fromDate = new Date(fromRaw);
    const toDate = new Date(toRaw);

    if (!fromRaw || !toRaw || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
      return NextResponse.json({ error: "Période invalide.", code: "STATS_INVALID_RANGE", reference }, { status: 400 });
    }

    const maxWindowMs = 366 * 24 * 60 * 60 * 1000 * 3;
    if (toDate.getTime() - fromDate.getTime() > maxWindowMs) {
      return NextResponse.json({ error: "La période maximale est de 3 ans.", code: "STATS_RANGE_TOO_LARGE", reference }, { status: 400 });
    }

    const { supabase } = await requireAdmin(request);
    const environment = getCommerceEnvironment();
    const allOrders = await fetchOrders(supabase, fromDate.toISOString(), toDate.toISOString(), environment);
    const orders = allOrders.filter(isBoutique);
    const paidOrders = orders.filter(isPaid);
    const refundedOrders = orders.filter(isRefunded);
    const itemsByOrder = await fetchOrderItems(supabase, paidOrders.map((order) => text(order.id)).filter(Boolean));

    const revenue = paidOrders.reduce((sum, order) => sum + numeric(order.total), 0);
    const discounts = paidOrders.reduce((sum, order) => sum + numeric(order.discount_amount), 0);
    const shippingFees = paidOrders.reduce((sum, order) => sum + numeric(order.shipping_fee), 0);
    const refunded = refundedOrders.reduce((sum, order) => sum + numeric(order.total), 0);
    const shippingOrders = paidOrders.filter((order) => normalized(order.order_type) === "shipping").length;
    const pickupOrders = paidOrders.filter((order) => normalized(order.order_type) === "pickup").length;
    const promoOrders = paidOrders.filter((order) => numeric(order.discount_amount) > 0 && text(order.promo_code)).length;

    const dailyMap = new Map<string, { date: string; revenue: number; orders: number }>();
    const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    const promoMap = new Map<string, { code: string; orders: number; discount: number }>();

    for (const order of paidOrders) {
      const date = parisDay(order.created_at);
      const daily = dailyMap.get(date) ?? { date, revenue: 0, orders: 0 };
      daily.revenue += numeric(order.total);
      daily.orders += 1;
      dailyMap.set(date, daily);

      for (const item of itemsByOrder.get(text(order.id)) ?? []) {
        const name = text(item.product_name) || "Produit";
        const current = productMap.get(name) ?? { name, quantity: 0, revenue: 0 };
        current.quantity += Math.max(0, Math.round(numeric(item.quantity)));
        current.revenue += numeric(item.line_total);
        productMap.set(name, current);
      }

      if (text(order.promo_code) && numeric(order.discount_amount) > 0) {
        const code = text(order.promo_code).toUpperCase();
        const current = promoMap.get(code) ?? { code, orders: 0, discount: 0 };
        current.orders += 1;
        current.discount += numeric(order.discount_amount);
        promoMap.set(code, current);
      }
    }

    return NextResponse.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: {
        revenue: Number(revenue.toFixed(2)),
        orderCount: paidOrders.length,
        averageOrder: paidOrders.length ? Number((revenue / paidOrders.length).toFixed(2)) : 0,
        discounts: Number(discounts.toFixed(2)),
        shippingFees: Number(shippingFees.toFixed(2)),
        refunded: Number(refunded.toFixed(2)),
        shippingOrders,
        pickupOrders,
        promoOrders,
      },
      daily: Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((item) => ({ ...item, revenue: Number(item.revenue.toFixed(2)) })),
      topProducts: Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
        .slice(0, 5)
        .map((item) => ({ ...item, revenue: Number(item.revenue.toFixed(2)) })),
      topPromos: Array.from(promoMap.values())
        .sort((a, b) => b.discount - a.discount || b.orders - a.orders)
        .slice(0, 5)
        .map((item) => ({ ...item, discount: Number(item.discount.toFixed(2)) })),
      diagnostics: {
        environment,
        boutiqueOrders: orders.length,
        paidOrders: paidOrders.length,
        unpaidOrders: orders.filter((order) => normalized(order.payment_status) !== "paid" && !isRefunded(order)).length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const info = technicalError(error);
    const stage = text((error as any)?.statsStage) || "auth_or_database";
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    const code = stage === "orders" ? "STATS_ORDERS_QUERY" : status === 401 ? "STATS_AUTH" : status === 403 ? "STATS_ADMIN" : "STATS_SERVER";

    console.error("[ORDER_STATS_ERROR]", { reference, code, stage, ...info });

    return NextResponse.json({
      error: status === 401 || status === 403
        ? "Session administrateur invalide. Reconnectez-vous puis réessayez."
        : "Impossible de calculer les statistiques pour le moment.",
      code,
      reference,
      ...(process.env.NODE_ENV !== "production" ? { technical: { stage, ...info } } : {}),
    }, { status });
  }
}
