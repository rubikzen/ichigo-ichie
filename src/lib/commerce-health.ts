import type { SupabaseClient } from "@supabase/supabase-js";

export type ReservationIssue = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  paymentExpiresAt: string | null;
  stockReserved: boolean;
  promoReserved: boolean;
  stockLeak: boolean;
  promoLeak: boolean;
  ageMinutes: number;
  reason: string;
  recoveryAction: "release_order_reservations" | "commit_paid_promo" | null;
  recoveryLabel: string | null;
};

export type PromoReservationMismatch = {
  id: string;
  code: string;
  reservedCount: number;
  orderReservations: number;
};

export type StockAlert = {
  id: string;
  kind: "product" | "variant";
  name: string;
  productName: string | null;
  sku: string | null;
  stock: number;
  severity: "out" | "low";
};

export type CommerceHealth = {
  summary: {
    reservationIssueCount: number;
    stockReservationLeaks: number;
    promoReservationLeaks: number;
    promoMismatchCount: number;
    outOfStock: number;
    lowStock: number;
  };
  reservationIssues: ReservationIssue[];
  promoMismatches: PromoReservationMismatch[];
  stockAlerts: StockAlert[];
  generatedAt: string;
};

const STALE_WITHOUT_EXPIRY_MS = 45 * 60 * 1000;
const EXPIRY_GRACE_MS = 5 * 60 * 1000;
const LOW_STOCK_THRESHOLD = 3;

function timestamp(value: unknown) {
  const parsed = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function reservationReason(order: any, now: number) {
  const paymentStatus = String(order.payment_status || "");
  const status = String(order.status || "");
  const createdAt = timestamp(order.created_at) ?? now;
  const expiresAt = timestamp(order.payment_expires_at);
  const ageMs = Math.max(0, now - createdAt);

  if (status === "cancelled") {
    return "Commande annulée mais une réservation est encore active.";
  }

  if (paymentStatus === "failed" || paymentStatus === "expired") {
    return "Paiement terminé sans succès mais une réservation est encore active.";
  }

  if (
    ["paid", "refunded", "refund_pending", "refund_failed"].includes(paymentStatus) &&
    order.promo_reserved
  ) {
    return "Le code promo est encore réservé après le traitement du paiement.";
  }

  if (
    order.payment_method === "online" &&
    ["pending", "unpaid"].includes(paymentStatus) &&
    expiresAt !== null &&
    expiresAt < now - EXPIRY_GRACE_MS
  ) {
    return "La fenêtre de paiement est expirée mais la réservation n’a pas été libérée.";
  }

  if (
    order.payment_method === "online" &&
    ["pending", "unpaid"].includes(paymentStatus) &&
    expiresAt === null &&
    ageMs > STALE_WITHOUT_EXPIRY_MS
  ) {
    return "Commande en attente ancienne sans échéance Stripe ; vérification requise.";
  }

  return "";
}

export async function collectCommerceHealth(
  supabase: SupabaseClient,
  environment: string,
): Promise<CommerceHealth> {
  const now = Date.now();

  const { data: reservedOrders, error: reservedOrdersError } = await supabase
    .from("orders")
    .select(
      "id,order_number,status,payment_status,payment_method,created_at,payment_expires_at,stock_reserved,promo_reserved,promo_code_id,environment,archived_at",
    )
    .eq("environment", environment)
    .is("archived_at", null)
    .or("stock_reserved.eq.true,promo_reserved.eq.true")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (reservedOrdersError) throw reservedOrdersError;

  const reservationIssues: ReservationIssue[] = [];

  for (const order of reservedOrders ?? []) {
    const reason = reservationReason(order, now);
    if (!reason) continue;

    const paymentStatus = String(order.payment_status || "");
    const moneyAlreadyProcessed = [
      "paid",
      "refunded",
      "refund_pending",
      "refund_failed",
    ].includes(paymentStatus);

    const stockLeak = Boolean(order.stock_reserved) && !moneyAlreadyProcessed;
    const promoLeak = Boolean(order.promo_reserved);
    const createdAtMs = timestamp(order.created_at) ?? now;
    const protectedFulfilment = ["preparing", "ready", "completed"].includes(
      String(order.status || ""),
    );
    const recoveryAction =
      promoLeak && moneyAlreadyProcessed
        ? "commit_paid_promo"
        : !moneyAlreadyProcessed &&
            !protectedFulfilment &&
            (stockLeak || promoLeak)
          ? "release_order_reservations"
          : null;
    const recoveryLabel =
      recoveryAction === "commit_paid_promo"
        ? "Finaliser promo"
        : recoveryAction === "release_order_reservations"
          ? "Libérer"
          : null;

    reservationIssues.push({
      id: String(order.id),
      orderNumber: String(order.order_number || order.id),
      status: String(order.status || ""),
      paymentStatus,
      createdAt: String(order.created_at || ""),
      paymentExpiresAt: order.payment_expires_at
        ? String(order.payment_expires_at)
        : null,
      stockReserved: Boolean(order.stock_reserved),
      promoReserved: Boolean(order.promo_reserved),
      stockLeak,
      promoLeak,
      ageMinutes: Math.max(0, Math.floor((now - createdAtMs) / 60_000)),
      reason,
      recoveryAction,
      recoveryLabel,
    });
  }

  // Promo `reserved_count` is global, so compare it with ALL currently reserved
  // orders rather than only the active TEST/LIVE environment.
  const [
    { data: promos, error: promosError },
    { data: promoReservationOrders, error: promoReservationOrdersError },
  ] = await Promise.all([
    supabase
      .from("promo_codes")
      .select("id,code,reserved_count")
      .order("code")
      .limit(1000),
    supabase
      .from("orders")
      .select("id,promo_code_id")
      .eq("promo_reserved", true)
      .limit(5000),
  ]);

  if (promosError) throw promosError;
  if (promoReservationOrdersError) throw promoReservationOrdersError;

  const reservationsByPromo = new Map<string, number>();
  for (const order of promoReservationOrders ?? []) {
    const promoId = String(order.promo_code_id || "");
    if (!promoId) continue;
    reservationsByPromo.set(
      promoId,
      (reservationsByPromo.get(promoId) ?? 0) + 1,
    );
  }

  const promoMismatches: PromoReservationMismatch[] = [];
  for (const promo of promos ?? []) {
    const id = String(promo.id);
    const reservedCount = numberValue(promo.reserved_count);
    const orderReservations = reservationsByPromo.get(id) ?? 0;
    if (reservedCount === orderReservations) continue;

    promoMismatches.push({
      id,
      code: String(promo.code || id),
      reservedCount,
      orderReservations,
    });
  }

  const { data: shopCategories, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("kind", "shop");

  if (categoryError) throw categoryError;

  const categoryIds = (shopCategories ?? []).map((row: any) => row.id);
  let products: any[] = [];
  let variants: any[] = [];

  if (categoryIds.length) {
    const { data: productRows, error: productError } = await supabase
      .from("products")
      .select("id,name_fr,stock,active,category_id")
      .in("category_id", categoryIds)
      .eq("active", true)
      .limit(2000);

    if (productError) throw productError;
    products = productRows ?? [];

    const productIds = products.map((row: any) => row.id);
    if (productIds.length) {
      const { data: variantRows, error: variantError } = await supabase
        .from("product_variants")
        .select("id,product_id,name,sku,stock,active")
        .in("product_id", productIds)
        .eq("active", true)
        .limit(5000);

      if (variantError) throw variantError;
      variants = variantRows ?? [];
    }
  }

  const activeVariantCount = new Map<string, number>();
  const productName = new Map<string, string>();

  for (const product of products) {
    productName.set(String(product.id), String(product.name_fr || "Produit"));
  }

  for (const variant of variants) {
    const productId = String(variant.product_id);
    activeVariantCount.set(
      productId,
      (activeVariantCount.get(productId) ?? 0) + 1,
    );
  }

  const stockAlerts: StockAlert[] = [];

  for (const variant of variants) {
    const stock = numberValue(variant.stock);
    if (stock > LOW_STOCK_THRESHOLD) continue;

    stockAlerts.push({
      id: String(variant.id),
      kind: "variant",
      name: String(variant.name || "Variante"),
      productName: productName.get(String(variant.product_id)) ?? null,
      sku: variant.sku ? String(variant.sku) : null,
      stock,
      severity: stock <= 0 ? "out" : "low",
    });
  }

  // When a product has active variants, stock is managed at variant level.
  // Do not flag its base product stock, which may legitimately stay at zero.
  for (const product of products) {
    if ((activeVariantCount.get(String(product.id)) ?? 0) > 0) continue;

    const stock = numberValue(product.stock);
    if (stock > LOW_STOCK_THRESHOLD) continue;

    stockAlerts.push({
      id: String(product.id),
      kind: "product",
      name: String(product.name_fr || "Produit"),
      productName: null,
      sku: null,
      stock,
      severity: stock <= 0 ? "out" : "low",
    });
  }

  stockAlerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "out" ? -1 : 1;
    return a.stock - b.stock || a.name.localeCompare(b.name, "fr");
  });

  return {
    summary: {
      reservationIssueCount: reservationIssues.length,
      stockReservationLeaks: reservationIssues.filter(
        (issue) => issue.stockLeak,
      ).length,
      promoReservationLeaks: reservationIssues.filter(
        (issue) => issue.promoLeak,
      ).length,
      promoMismatchCount: promoMismatches.length,
      outOfStock: stockAlerts.filter((alert) => alert.severity === "out").length,
      lowStock: stockAlerts.filter((alert) => alert.severity === "low").length,
    },
    reservationIssues: reservationIssues.slice(0, 30),
    promoMismatches: promoMismatches.slice(0, 30),
    stockAlerts: stockAlerts.slice(0, 40),
    generatedAt: new Date(now).toISOString(),
  };
}
