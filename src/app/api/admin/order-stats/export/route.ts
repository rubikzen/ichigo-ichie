import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/admin-auth";
import { getCommerceEnvironment } from "@/lib/runtime-environment";

type AnyRow = Record<string, any>;
type ExportFormat = "csv" | "xlsx";

const parisDateTime = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

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

function orderCustomer(order: AnyRow) {
  return [text(order.customer_first_name), text(order.customer_last_name)].filter(Boolean).join(" ") || "—";
}

function fulfillment(order: AnyRow) {
  return normalized(order.order_type) === "shipping" ? "Livraison" : "Retrait boutique";
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function euro(value: number) {
  return Number(value || 0).toFixed(2).replace(".", ",");
}

function periodLabel(from: Date, to: Date) {
  const inclusiveTo = new Date(to.getTime() - 1);
  return `${parisDay(from.toISOString())} au ${parisDay(inclusiveTo.toISOString())}`;
}

async function fetchOrders(supabase: any, from: string, to: string, environment: "test" | "live") {
  const pageSize = 1000;
  const rows: AnyRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("environment", environment)
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
  return rows;
}

async function fetchOrderItems(supabase: any, orderIds: string[]) {
  const map = new Map<string, AnyRow[]>();
  const chunkSize = 100;
  for (let index = 0; index < orderIds.length; index += chunkSize) {
    const chunk = orderIds.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const { data, error } = await supabase.from("order_items").select("*").in("order_id", chunk);
    if (error) {
      console.warn("[ORDER_STATS_EXPORT_ITEMS_WARNING]", error);
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

function buildReport(orders: AnyRow[], itemsByOrder: Map<string, AnyRow[]>) {
  const paidOrders = orders.filter(isPaid);
  const refundedOrders = orders.filter(isRefunded);
  const revenue = paidOrders.reduce((sum, order) => sum + numeric(order.total), 0);
  const discounts = paidOrders.reduce((sum, order) => sum + numeric(order.discount_amount), 0);
  const shippingFees = paidOrders.reduce((sum, order) => sum + numeric(order.shipping_fee), 0);
  const refunded = refundedOrders.reduce((sum, order) => sum + numeric(order.total), 0);

  const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>();
  const productMap = new Map<string, { product: string; quantity: number; revenue: number }>();
  const promoMap = new Map<string, { code: string; orders: number; discount: number; revenue: number }>();

  for (const order of paidOrders) {
    const day = parisDay(order.created_at);
    const daily = dailyMap.get(day) ?? { date: day, orders: 0, revenue: 0 };
    daily.orders += 1;
    daily.revenue += numeric(order.total);
    dailyMap.set(day, daily);

    for (const item of itemsByOrder.get(text(order.id)) ?? []) {
      const name = text(item.product_name) || "Produit";
      const current = productMap.get(name) ?? { product: name, quantity: 0, revenue: 0 };
      current.quantity += Math.max(0, Math.round(numeric(item.quantity)));
      current.revenue += numeric(item.line_total);
      productMap.set(name, current);
    }

    const promoCode = text(order.promo_code).toUpperCase();
    if (promoCode && numeric(order.discount_amount) > 0) {
      const current = promoMap.get(promoCode) ?? { code: promoCode, orders: 0, discount: 0, revenue: 0 };
      current.orders += 1;
      current.discount += numeric(order.discount_amount);
      current.revenue += numeric(order.total);
      promoMap.set(promoCode, current);
    }
  }

  const orderRows = paidOrders.map((order) => ({
    date: parisDateTime.format(new Date(order.created_at)),
    orderNumber: text(order.order_number),
    customer: orderCustomer(order),
    email: text(order.customer_email),
    phone: text(order.customer_phone),
    fulfillment: fulfillment(order),
    city: text(order.shipping_city),
    postalCode: text(order.shipping_postal_code),
    subtotal: numeric(order.subtotal),
    discount: numeric(order.discount_amount),
    shipping: numeric(order.shipping_fee),
    total: numeric(order.total),
    promo: text(order.promo_code).toUpperCase(),
    status: text(order.status),
    paymentStatus: text(order.payment_status),
    carrier: text(order.tracking_carrier),
    tracking: text(order.tracking_number),
  }));

  return {
    summary: {
      revenue,
      orderCount: paidOrders.length,
      averageOrder: paidOrders.length ? revenue / paidOrders.length : 0,
      discounts,
      shippingFees,
      refunded,
      shippingOrders: paidOrders.filter((order) => normalized(order.order_type) === "shipping").length,
      pickupOrders: paidOrders.filter((order) => normalized(order.order_type) === "pickup").length,
    },
    orders: orderRows,
    daily: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    products: Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue),
    promos: Array.from(promoMap.values()).sort((a, b) => b.discount - a.discount || b.orders - a.orders),
  };
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF274D3B" } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
}

function addTitle(sheet: ExcelJS.Worksheet, title: string, period: string) {
  sheet.mergeCells("A1:H1");
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { bold: true, size: 18, color: { argb: "FF274D3B" } };
  sheet.mergeCells("A2:H2");
  sheet.getCell("A2").value = `Période : ${period}`;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF68766E" } };
}

function autoWidths(sheet: ExcelJS.Worksheet, min = 12, max = 38) {
  sheet.columns.forEach((column) => {
    let width = min;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? "").length + 2;
      width = Math.min(max, Math.max(width, length));
    });
    column.width = width;
  });
}

async function createXlsx(report: ReturnType<typeof buildReport>, from: Date, to: Date) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ichigo Ichie";
  workbook.created = new Date();
  const period = periodLabel(from, to);

  const summary = workbook.addWorksheet("Résumé", { views: [{ state: "frozen", ySplit: 4 }] });
  addTitle(summary, "Ichigo Ichie — Pilotage Boutique", period);
  summary.addRow([]);
  const summaryHeader = summary.addRow(["Indicateur", "Valeur"]);
  styleHeader(summaryHeader);
  const s = report.summary;
  [
    ["CA encaissé", s.revenue],
    ["Commandes payées", s.orderCount],
    ["Panier moyen", s.averageOrder],
    ["Remises", s.discounts],
    ["Frais de livraison", s.shippingFees],
    ["Remboursé", s.refunded],
    ["Livraisons", s.shippingOrders],
    ["Retraits boutique", s.pickupOrders],
  ].forEach((row) => summary.addRow(row));
  [5, 7, 8, 9, 10].forEach((rowNumber) => { summary.getCell(`B${rowNumber}`).numFmt = '#,##0.00 [$€-fr-FR]'; });
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 20;

  const orders = workbook.addWorksheet("Commandes", { views: [{ state: "frozen", ySplit: 4 }] });
  addTitle(orders, "Commandes payées", period);
  orders.addRow([]);
  const orderHeaders = ["Date", "N° commande", "Client", "Email", "Téléphone", "Mode", "CP", "Ville", "Sous-total", "Remise", "Livraison", "Total", "Code promo", "Statut", "Paiement", "Transporteur", "N° suivi"];
  const ordersHeader = orders.addRow(orderHeaders);
  styleHeader(ordersHeader);
  for (const row of report.orders) {
    orders.addRow([row.date, row.orderNumber, row.customer, row.email, row.phone, row.fulfillment, row.postalCode, row.city, row.subtotal, row.discount, row.shipping, row.total, row.promo, row.status, row.paymentStatus, row.carrier, row.tracking]);
  }
  [9, 10, 11, 12].forEach((col) => { orders.getColumn(col).numFmt = '#,##0.00 [$€-fr-FR]'; });
  orders.autoFilter = { from: "A4", to: "Q4" };
  autoWidths(orders, 12, 32);

  const daily = workbook.addWorksheet("CA quotidien", { views: [{ state: "frozen", ySplit: 4 }] });
  addTitle(daily, "Évolution du chiffre d’affaires", period);
  daily.addRow([]);
  const dailyHeader = daily.addRow(["Date", "Commandes", "CA encaissé"]);
  styleHeader(dailyHeader);
  report.daily.forEach((row) => daily.addRow([row.date, row.orders, row.revenue]));
  daily.getColumn(3).numFmt = '#,##0.00 [$€-fr-FR]';
  autoWidths(daily);

  const products = workbook.addWorksheet("Produits", { views: [{ state: "frozen", ySplit: 4 }] });
  addTitle(products, "Produits vendus", period);
  products.addRow([]);
  const productsHeader = products.addRow(["Produit", "Quantité vendue", "CA produits"]);
  styleHeader(productsHeader);
  report.products.forEach((row) => products.addRow([row.product, row.quantity, row.revenue]));
  products.getColumn(3).numFmt = '#,##0.00 [$€-fr-FR]';
  autoWidths(products);

  const promos = workbook.addWorksheet("Promos", { views: [{ state: "frozen", ySplit: 4 }] });
  addTitle(promos, "Codes promo", period);
  promos.addRow([]);
  const promosHeader = promos.addRow(["Code", "Utilisations", "Réduction accordée", "CA encaissé"]);
  styleHeader(promosHeader);
  report.promos.forEach((row) => promos.addRow([row.code, row.orders, row.discount, row.revenue]));
  promos.getColumn(3).numFmt = '#,##0.00 [$€-fr-FR]';
  promos.getColumn(4).numFmt = '#,##0.00 [$€-fr-FR]';
  autoWidths(promos);

  return workbook.xlsx.writeBuffer();
}

function createCsv(report: ReturnType<typeof buildReport>) {
  const headers = ["Date", "N° commande", "Client", "Email", "Téléphone", "Mode", "Code postal", "Ville", "Sous-total (€)", "Remise (€)", "Livraison (€)", "Total (€)", "Code promo", "Statut", "Paiement", "Transporteur", "N° suivi"];
  const rows = report.orders.map((row) => [row.date, row.orderNumber, row.customer, row.email, row.phone, row.fulfillment, row.postalCode, row.city, euro(row.subtotal), euro(row.discount), euro(row.shipping), euro(row.total), row.promo, row.status, row.paymentStatus, row.carrier, row.tracking]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = (url.searchParams.get("format") === "csv" ? "csv" : "xlsx") as ExportFormat;
    const fromRaw = url.searchParams.get("from") || "";
    const toRaw = url.searchParams.get("to") || "";
    const fromDate = new Date(fromRaw);
    const toDate = new Date(toRaw);

    if (!fromRaw || !toRaw || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate >= toDate) {
      return NextResponse.json({ error: "Période invalide." }, { status: 400 });
    }
    if (toDate.getTime() - fromDate.getTime() > 366 * 24 * 60 * 60 * 1000 * 3) {
      return NextResponse.json({ error: "La période maximale est de 3 ans." }, { status: 400 });
    }

    const { supabase } = await requireAdmin(request);
    const environment = getCommerceEnvironment();
    const allOrders = await fetchOrders(supabase, fromDate.toISOString(), toDate.toISOString(), environment);
    const boutiqueOrders = allOrders.filter(isBoutique);
    const paidIds = boutiqueOrders.filter(isPaid).map((order) => text(order.id)).filter(Boolean);
    const itemsByOrder = await fetchOrderItems(supabase, paidIds);
    const report = buildReport(boutiqueOrders, itemsByOrder);
    const fileDate = parisDay(new Date().toISOString()).replace(/-/g, "");

    if (format === "csv") {
      const csv = createCsv(report);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="ichigo-commandes-${fileDate}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const buffer = await createXlsx(report, fromDate, toDate);
    return new Response(buffer as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ichigo-statistiques-${fileDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[ORDER_STATS_EXPORT_ERROR]", error);
    const message = error instanceof Error ? error.message : "Export impossible.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
