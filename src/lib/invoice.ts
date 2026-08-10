import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

type InvoiceType = "invoice" | "credit_note";

type InvoiceConfig = {
  enabled: boolean;
  autoEmail: boolean;
  invoicePrefix: string;
  creditNotePrefix: string;
  shippingVatRate: number;
  legalName: string;
  tradeName: string;
  address1: string;
  address2: string;
  postalCode: string;
  city: string;
  country: string;
  siren: string;
  siret: string;
  vatNumber: string;
  rcs: string;
  capital: string;
  email: string;
  phone: string;
  footer: string;
};

type InvoiceLine = {
  kind: "product" | "shipping";
  description: string;
  quantity: number;
  vat_rate: number;
  gross_ttc: number;
  discount_share: number;
  net_ttc: number;
  net_ht: number;
  tax_amount: number;
  unit_ttc: number;
};

type InvoiceRow = {
  id: string;
  order_id: string;
  customer_id?: string | null;
  document_type: InvoiceType;
  original_invoice_id?: string | null;
  document_number: string;
  issued_at: string;
  seller_snapshot: Record<string, unknown>;
  customer_snapshot: Record<string, unknown>;
  lines: InvoiceLine[];
  tax_summary: Array<{ rate: number; base_ht: number; tax: number; total_ttc: number }>;
  subtotal_ttc: number;
  discount_ttc: number;
  shipping_ttc: number;
  total_ht: number;
  total_tax: number;
  total_ttc: number;
  email_sent_at?: string | null;
};

function valueAsString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "";
  return String(value);
}

function settingBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  const text = valueAsString(value).trim().toLowerCase();
  if (!text) return fallback;
  return !["false", "0", "no", "non", "off"].includes(text);
}

function settingNumber(value: unknown, fallback = 0) {
  const parsed = Number(valueAsString(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function euros(centsValue: number) {
  return Math.round(centsValue) / 100;
}

function vatRate(value: unknown) {
  if (value == null || valueAsString(value).trim() === "") return null;
  const number = settingNumber(value, NaN);
  return Number.isFinite(number) && number >= 0 && number <= 100 ? Math.round(number * 100) / 100 : null;
}

export async function getInvoiceConfig(supabase: SupabaseClient): Promise<InvoiceConfig> {
  const keys = [
    "invoice_enabled", "invoice_auto_email", "invoice_prefix", "credit_note_prefix", "invoice_shipping_vat_rate",
    "invoice_legal_name", "invoice_trade_name", "invoice_address1", "invoice_address2", "invoice_postal_code", "invoice_city",
    "invoice_country", "invoice_siren", "invoice_siret", "invoice_vat_number", "invoice_rcs", "invoice_capital",
    "invoice_email", "invoice_phone", "invoice_footer",
  ];
  const { data, error } = await supabase.from("site_settings").select("key,value").in("key", keys);
  if (error) throw error;
  const map = new Map((data ?? []).map((row: any) => [row.key, row.value]));
  return {
    enabled: settingBoolean(map.get("invoice_enabled"), false),
    autoEmail: settingBoolean(map.get("invoice_auto_email"), true),
    invoicePrefix: valueAsString(map.get("invoice_prefix") || "FAC").trim() || "FAC",
    creditNotePrefix: valueAsString(map.get("credit_note_prefix") || "AV").trim() || "AV",
    shippingVatRate: settingNumber(map.get("invoice_shipping_vat_rate"), 20),
    legalName: valueAsString(map.get("invoice_legal_name")).trim(),
    tradeName: valueAsString(map.get("invoice_trade_name") || "ICHIGO ICHIE").trim(),
    address1: valueAsString(map.get("invoice_address1")).trim(),
    address2: valueAsString(map.get("invoice_address2")).trim(),
    postalCode: valueAsString(map.get("invoice_postal_code")).trim(),
    city: valueAsString(map.get("invoice_city")).trim(),
    country: valueAsString(map.get("invoice_country") || "France").trim() || "France",
    siren: valueAsString(map.get("invoice_siren")).trim(),
    siret: valueAsString(map.get("invoice_siret")).trim(),
    vatNumber: valueAsString(map.get("invoice_vat_number")).trim(),
    rcs: valueAsString(map.get("invoice_rcs")).trim(),
    capital: valueAsString(map.get("invoice_capital")).trim(),
    email: valueAsString(map.get("invoice_email")).trim(),
    phone: valueAsString(map.get("invoice_phone")).trim(),
    footer: valueAsString(map.get("invoice_footer") || "Merci pour votre confiance.").trim(),
  };
}

export function validateInvoiceConfig(config: InvoiceConfig) {
  const missing: string[] = [];
  if (!config.legalName) missing.push("raison sociale");
  if (!config.address1) missing.push("adresse");
  if (!config.postalCode) missing.push("code postal");
  if (!config.city) missing.push("ville");
  if (!config.siren) missing.push("SIREN");
  if (config.shippingVatRate < 0 || config.shippingVatRate > 100) missing.push("TVA livraison");
  if (missing.length) throw new Error(`INVOICE_CONFIG_INCOMPLETE: ${missing.join(", ")}`);
}

export async function assertInvoiceReadyForProducts(supabase: SupabaseClient, productIds: string[]) {
  const config = await getInvoiceConfig(supabase);
  if (!config.enabled || !productIds.length) return config;
  validateInvoiceConfig(config);
  const { data, error } = await supabase.from("products").select("id,name_fr,vat_rate").in("id", productIds);
  if (error) throw error;
  const missing = (data ?? []).filter((row: any) => vatRate(row.vat_rate) == null);
  if (missing.length) throw new Error(`INVOICE_VAT_NOT_CONFIGURED: ${missing.map((row: any) => row.name_fr).join(", ")}`);
  return config;
}

async function loadOrderForInvoice(supabase: SupabaseClient, orderId: string) {
  const { data: order, error } = await supabase.from("orders").select(`
    id,order_number,public_token,customer_id,customer_first_name,customer_last_name,customer_email,customer_phone,
    payment_status,paid_at,order_type,subtotal,discount_amount,shipping_fee,total,shipping_method_name,
    shipping_address1,shipping_address2,shipping_postal_code,shipping_city,shipping_country,
    order_items(id,product_id,product_name,quantity,unit_price,line_total,vat_rate)
  `).eq("id", orderId).single();
  if (error || !order) throw error ?? new Error("Commande introuvable.");
  return order as any;
}

async function resolveProductVatRates(supabase: SupabaseClient, order: any) {
  const missingIds = Array.from(new Set((order.order_items ?? [])
    .filter((item: any) => vatRate(item.vat_rate) == null && item.product_id)
    .map((item: any) => item.product_id))) as string[];
  const map = new Map<string, number>();
  if (missingIds.length) {
    const { data, error } = await supabase.from("products").select("id,vat_rate").in("id", missingIds);
    if (error) throw error;
    for (const row of data ?? []) {
      const rate = vatRate((row as any).vat_rate);
      if (rate != null) map.set((row as any).id, rate);
    }
  }
  return map;
}

async function customerSnapshot(supabase: SupabaseClient, order: any) {
  let savedAddress: any = null;
  if (order.customer_id && order.order_type !== "shipping") {
    const { data } = await supabase.from("customer_addresses")
      .select("address1,address2,postal_code,city,country")
      .eq("customer_id", order.customer_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    savedAddress = data;
  }
  const address = order.order_type === "shipping" ? {
    address1: order.shipping_address1,
    address2: order.shipping_address2,
    postal_code: order.shipping_postal_code,
    city: order.shipping_city,
    country: order.shipping_country || "FR",
  } : savedAddress;
  return {
    name: [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ").trim(),
    email: order.customer_email || "",
    phone: order.customer_phone || "",
    address1: address?.address1 || "",
    address2: address?.address2 || "",
    postal_code: address?.postal_code || "",
    city: address?.city || "",
    country: address?.country || "FR",
  };
}

function sellerSnapshot(config: InvoiceConfig) {
  return {
    legal_name: config.legalName,
    trade_name: config.tradeName,
    address1: config.address1,
    address2: config.address2,
    postal_code: config.postalCode,
    city: config.city,
    country: config.country,
    siren: config.siren,
    siret: config.siret,
    vat_number: config.vatNumber,
    rcs: config.rcs,
    capital: config.capital,
    email: config.email,
    phone: config.phone,
    footer: config.footer,
  };
}

function calculateLines(order: any, productVatMap: Map<string, number>, shippingVatRate: number) {
  const sourceItems = order.order_items ?? [];
  const merchandiseGrossCents = sourceItems.reduce((sum: number, item: any) => sum + cents(item.line_total), 0);
  const discountCents = Math.min(Math.max(0, cents(order.discount_amount)), merchandiseGrossCents);
  let allocated = 0;

  const lines: InvoiceLine[] = sourceItems.map((item: any, index: number) => {
    const gross = cents(item.line_total);
    const rate = vatRate(item.vat_rate) ?? (item.product_id ? productVatMap.get(item.product_id) ?? null : null);
    if (rate == null) throw new Error(`INVOICE_VAT_NOT_CONFIGURED: ${item.product_name}`);
    let discountShare = 0;
    if (discountCents > 0 && merchandiseGrossCents > 0) {
      discountShare = index === sourceItems.length - 1
        ? discountCents - allocated
        : Math.floor(discountCents * (gross / merchandiseGrossCents));
      discountShare = Math.max(0, Math.min(discountShare, gross));
      allocated += discountShare;
    }
    const netTtc = gross - discountShare;
    const netHt = Math.round(netTtc / (1 + rate / 100));
    const tax = netTtc - netHt;
    return {
      kind: "product" as const,
      description: String(item.product_name),
      quantity: Number(item.quantity || 1),
      vat_rate: rate,
      gross_ttc: euros(gross),
      discount_share: euros(discountShare),
      net_ttc: euros(netTtc),
      net_ht: euros(netHt),
      tax_amount: euros(tax),
      unit_ttc: euros(Math.round(netTtc / Math.max(1, Number(item.quantity || 1)))),
    };
  });

  const shippingCents = cents(order.shipping_fee);
  if (shippingCents > 0) {
    const rate = vatRate(shippingVatRate);
    if (rate == null) throw new Error("INVOICE_SHIPPING_VAT_NOT_CONFIGURED");
    const ht = Math.round(shippingCents / (1 + rate / 100));
    lines.push({
      kind: "shipping",
      description: order.shipping_method_name || "Livraison",
      quantity: 1,
      vat_rate: rate,
      gross_ttc: euros(shippingCents),
      discount_share: 0,
      net_ttc: euros(shippingCents),
      net_ht: euros(ht),
      tax_amount: euros(shippingCents - ht),
      unit_ttc: euros(shippingCents),
    });
  }
  return lines;
}

function summarizeTax(lines: InvoiceLine[]) {
  const grouped = new Map<number, { rate: number; base_ht: number; tax: number; total_ttc: number }>();
  for (const line of lines) {
    const current = grouped.get(line.vat_rate) ?? { rate: line.vat_rate, base_ht: 0, tax: 0, total_ttc: 0 };
    current.base_ht = Math.round((current.base_ht + line.net_ht) * 100) / 100;
    current.tax = Math.round((current.tax + line.tax_amount) * 100) / 100;
    current.total_ttc = Math.round((current.total_ttc + line.net_ttc) * 100) / 100;
    grouped.set(line.vat_rate, current);
  }
  return [...grouped.values()].sort((a, b) => a.rate - b.rate);
}

export async function ensureInvoiceForOrder(supabase: SupabaseClient, orderId: string, options: { force?: boolean } = {}) {
  const { data: existing } = await supabase.from("invoices").select("*").eq("order_id", orderId).eq("document_type", "invoice").maybeSingle();
  if (existing) return existing as InvoiceRow;

  const config = await getInvoiceConfig(supabase);
  if (!config.enabled && !options.force) return null;
  validateInvoiceConfig(config);
  const order = await loadOrderForInvoice(supabase, orderId);
  if (order.payment_status !== "paid" && order.payment_status !== "refunded") throw new Error("INVOICE_ORDER_NOT_PAID");
  const productVatMap = await resolveProductVatRates(supabase, order);
  const lines = calculateLines(order, productVatMap, config.shippingVatRate);
  const taxSummary = summarizeTax(lines);
  const totalHt = Math.round(lines.reduce((sum, line) => sum + line.net_ht, 0) * 100) / 100;
  const totalTax = Math.round(lines.reduce((sum, line) => sum + line.tax_amount, 0) * 100) / 100;
  const totalTtc = Math.round(lines.reduce((sum, line) => sum + line.net_ttc, 0) * 100) / 100;
  if (Math.abs(totalTtc - Number(order.total)) > 0.02) throw new Error(`INVOICE_TOTAL_MISMATCH: ${totalTtc} vs ${order.total}`);

  const { data, error } = await supabase.rpc("issue_invoice_document", {
    p_order_id: orderId,
    p_document_type: "invoice",
    p_original_invoice_id: null,
    p_seller: sellerSnapshot(config),
    p_customer: await customerSnapshot(supabase, order),
    p_lines: lines,
    p_tax_summary: taxSummary,
    p_subtotal_ttc: Number(order.subtotal || 0),
    p_discount_ttc: Number(order.discount_amount || 0),
    p_shipping_ttc: Number(order.shipping_fee || 0),
    p_total_ht: totalHt,
    p_total_tax: totalTax,
    p_total_ttc: totalTtc,
    p_prefix: config.invoicePrefix,
  });
  if (error || !data) throw error ?? new Error("INVOICE_ISSUE_FAILED");
  return data as InvoiceRow;
}

export async function ensureCreditNoteForOrder(supabase: SupabaseClient, orderId: string, options: { force?: boolean } = {}) {
  const { data: existing } = await supabase.from("invoices").select("*").eq("order_id", orderId).eq("document_type", "credit_note").maybeSingle();
  if (existing) return existing as InvoiceRow;
  const config = await getInvoiceConfig(supabase);
  if (!config.enabled && !options.force) return null;
  validateInvoiceConfig(config);
  const original = await ensureInvoiceForOrder(supabase, orderId, { force: true });
  if (!original) throw new Error("INVOICE_ORIGINAL_MISSING");
  const negativeLines = original.lines.map((line) => ({
    ...line,
    gross_ttc: -Math.abs(line.gross_ttc),
    discount_share: -Math.abs(line.discount_share),
    net_ttc: -Math.abs(line.net_ttc),
    net_ht: -Math.abs(line.net_ht),
    tax_amount: -Math.abs(line.tax_amount),
    unit_ttc: -Math.abs(line.unit_ttc),
  }));
  const negativeTax = original.tax_summary.map((row) => ({ ...row, base_ht: -Math.abs(row.base_ht), tax: -Math.abs(row.tax), total_ttc: -Math.abs(row.total_ttc) }));
  const { data, error } = await supabase.rpc("issue_invoice_document", {
    p_order_id: orderId,
    p_document_type: "credit_note",
    p_original_invoice_id: original.id,
    p_seller: original.seller_snapshot,
    p_customer: original.customer_snapshot,
    p_lines: negativeLines,
    p_tax_summary: negativeTax,
    p_subtotal_ttc: -Math.abs(Number(original.subtotal_ttc)),
    p_discount_ttc: -Math.abs(Number(original.discount_ttc)),
    p_shipping_ttc: -Math.abs(Number(original.shipping_ttc)),
    p_total_ht: -Math.abs(Number(original.total_ht)),
    p_total_tax: -Math.abs(Number(original.total_tax)),
    p_total_ttc: -Math.abs(Number(original.total_ttc)),
    p_prefix: config.creditNotePrefix,
  });
  if (error || !data) throw error ?? new Error("CREDIT_NOTE_ISSUE_FAILED");
  return data as InvoiceRow;
}

export async function loadInvoiceDocument(supabase: SupabaseClient, orderId: string, type: InvoiceType = "invoice") {
  const { data, error } = await supabase.from("invoices").select("*").eq("order_id", orderId).eq("document_type", type).maybeSingle();
  if (error) throw error;
  return data as InvoiceRow | null;
}

function money(value: number) {
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + " EUR";
}

function safePdfText(value: unknown) {
  return String(value ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/’/g, "'")
    .replace(/œ/g, "oe").replace(/Œ/g, "OE")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function drawText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size = 9, color = rgb(0.14, 0.21, 0.17)) {
  page.drawText(safePdfText(text), { x, y, size, font, color });
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = safePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function generateInvoicePdf(invoice: InvoiceRow, orderNumber: string) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const green = rgb(0.15, 0.27, 0.22);
  const pale = rgb(0.96, 0.95, 0.91);
  const grey = rgb(0.38, 0.43, 0.40);
  const seller: any = invoice.seller_snapshot || {};
  const customer: any = invoice.customer_snapshot || {};
  const lines = Array.isArray(invoice.lines) ? invoice.lines : [];

  const margin = 42;
  let y = 792;
  drawText(page, bold, String(seller.trade_name || seller.legal_name || "ICHIGO ICHIE"), margin, y, 11, green);
  y -= 36;
  drawText(page, serif, invoice.document_type === "credit_note" ? "AVOIR" : "FACTURE", margin, y, 30, green);
  drawText(page, bold, invoice.document_number, 390, y + 8, 12, green);
  drawText(page, regular, `Date : ${new Date(invoice.issued_at).toLocaleDateString("fr-FR")}`, 390, y - 10, 9, grey);
  drawText(page, regular, `Commande : ${orderNumber}`, 390, y - 25, 9, grey);

  y -= 56;
  page.drawRectangle({ x: margin, y: y - 78, width: 245, height: 88, color: pale, borderColor: rgb(0.88,0.87,0.82), borderWidth: 0.7 });
  page.drawRectangle({ x: 308, y: y - 78, width: 245, height: 88, color: pale, borderColor: rgb(0.88,0.87,0.82), borderWidth: 0.7 });
  drawText(page, bold, "VENDEUR", margin + 12, y - 8, 8, green);
  const sellerRows = [seller.legal_name, seller.address1, seller.address2, `${seller.postal_code || ""} ${seller.city || ""}`.trim(), seller.country, seller.siren ? `SIREN : ${seller.siren}` : "", seller.vat_number ? `TVA : ${seller.vat_number}` : ""].filter(Boolean);
  sellerRows.slice(0, 6).forEach((row: any, i: number) => drawText(page, i === 0 ? bold : regular, String(row), margin + 12, y - 24 - i * 10, 8.3));
  drawText(page, bold, "CLIENT", 320, y - 8, 8, green);
  const customerRows = [customer.name, customer.address1, customer.address2, `${customer.postal_code || ""} ${customer.city || ""}`.trim(), customer.country && customer.country !== "FR" ? customer.country : "France", customer.email].filter(Boolean);
  customerRows.slice(0, 6).forEach((row: any, i: number) => drawText(page, i === 0 ? bold : regular, String(row), 320, y - 24 - i * 10, 8.3));

  y -= 112;
  const col = { desc: margin, qty: 330, vat: 380, unit: 430, total: 500 };
  page.drawRectangle({ x: margin, y: y - 20, width: 511, height: 24, color: green });
  drawText(page, bold, "Description", col.desc + 7, y - 12, 8, rgb(1,1,1));
  drawText(page, bold, "Qté", col.qty, y - 12, 8, rgb(1,1,1));
  drawText(page, bold, "TVA", col.vat, y - 12, 8, rgb(1,1,1));
  drawText(page, bold, "PU TTC", col.unit, y - 12, 8, rgb(1,1,1));
  drawText(page, bold, "Total TTC", col.total, y - 12, 8, rgb(1,1,1));
  y -= 32;

  for (const line of lines) {
    if (y < 165) {
      page = pdf.addPage([595.28, 841.89]);
      y = 790;
    }
    const descLines = wrap(regular, line.description, 8.7, 265);
    const rowHeight = Math.max(24, 12 + descLines.length * 10);
    descLines.forEach((row, i) => drawText(page, regular, row, col.desc + 7, y - 10 - i * 10, 8.7));
    drawText(page, regular, String(line.quantity), col.qty, y - 10, 8.7);
    drawText(page, regular, `${line.vat_rate.toLocaleString("fr-FR")} %`, col.vat, y - 10, 8.7);
    drawText(page, regular, money(line.unit_ttc), col.unit, y - 10, 8.3);
    drawText(page, bold, money(line.net_ttc), col.total, y - 10, 8.3);
    page.drawLine({ start: { x: margin, y: y - rowHeight }, end: { x: 553, y: y - rowHeight }, thickness: 0.5, color: rgb(0.88,0.87,0.82) });
    y -= rowHeight;
  }

  y -= 12;
  if (invoice.discount_ttc > 0) {
    drawText(page, regular, `Remise commerciale incluse : -${money(invoice.discount_ttc)}`, margin, y, 8.5, grey);
    y -= 18;
  }
  const totalsX = 365;
  drawText(page, regular, "Total HT", totalsX, y, 9); drawText(page, bold, money(invoice.total_ht), 485, y, 9); y -= 16;
  for (const tax of invoice.tax_summary || []) {
    drawText(page, regular, `TVA ${tax.rate.toLocaleString("fr-FR")} %`, totalsX, y, 9); drawText(page, regular, money(tax.tax), 485, y, 9); y -= 16;
  }
  page.drawLine({ start: { x: totalsX, y: y + 6 }, end: { x: 553, y: y + 6 }, thickness: 1, color: green });
  drawText(page, bold, "TOTAL TTC", totalsX, y - 8, 13, green); drawText(page, bold, money(invoice.total_ttc), 475, y - 8, 13, green);
  y -= 48;

  if (invoice.document_type === "credit_note" && invoice.original_invoice_id) {
    drawText(page, regular, "Avoir relatif à la facture d'origine associée à cette commande.", margin, y, 8.5, grey);
    y -= 18;
  }
  drawText(page, regular, "Paiement : carte / portefeuille via Stripe - montant confirmé avant émission.", margin, y, 8.5, grey);
  y -= 16;
  if (seller.rcs) { drawText(page, regular, `RCS : ${seller.rcs}`, margin, y, 8.2, grey); y -= 13; }
  if (seller.siret) { drawText(page, regular, `SIRET : ${seller.siret}`, margin, y, 8.2, grey); y -= 13; }
  if (seller.capital) { drawText(page, regular, `Capital social : ${seller.capital}`, margin, y, 8.2, grey); y -= 13; }
  if (seller.footer) drawText(page, regular, String(seller.footer), margin, Math.max(38, y - 6), 8.2, grey);

  return Buffer.from(await pdf.save());
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function sendInvoiceDocumentEmail(supabase: SupabaseClient, invoice: InvoiceRow, order: any) {
  const config = await getInvoiceConfig(supabase);
  if (!config.autoEmail || invoice.email_sent_at || !order.customer_email) return { skipped: true as const };
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return { skipped: true as const };
  const pdf = await generateInvoicePdf(invoice, order.order_number);
  const token = order.public_token ? `?token=${encodeURIComponent(order.public_token)}${invoice.document_type === "credit_note" ? "&type=credit_note" : ""}` : "";
  const downloadUrl = `${siteOrigin()}/api/invoices/${order.id}${token}`;
  const label = invoice.document_type === "credit_note" ? "avoir" : "facture";
  const subject = `Ichigo Ichie · Votre ${label} ${invoice.document_number}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${invoice.document_type}-${invoice.id}`.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [order.customer_email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;color:#26362d;max-width:620px;margin:auto;padding:28px"><p style="font-size:12px;letter-spacing:.18em;font-weight:700">ICHIGO ICHIE</p><h1 style="font-family:Georgia,serif">Votre ${label}</h1><p>Bonjour ${String(order.customer_first_name || "")}, vous trouverez en pièce jointe le document <strong>${invoice.document_number}</strong> relatif à la commande ${order.order_number}.</p><p><a href="${downloadUrl}" style="display:inline-block;background:#294237;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px">Télécharger le PDF</a></p></div>`,
      attachments: [{ filename: `${invoice.document_number}.pdf`, content: pdf.toString("base64") }],
    }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}: ${await response.text()}`);
  await supabase.from("invoices").update({ email_sent_at: new Date().toISOString() }).eq("id", invoice.id).is("email_sent_at", null);
  return { skipped: false as const };
}

export async function issueAndEmailInvoice(supabase: SupabaseClient, orderId: string, force = false) {
  const invoice = await ensureInvoiceForOrder(supabase, orderId, { force });
  if (!invoice) return null;
  const order = await loadOrderForInvoice(supabase, orderId);
  await sendInvoiceDocumentEmail(supabase, invoice, order);
  return invoice;
}

export async function issueAndEmailCreditNote(supabase: SupabaseClient, orderId: string, force = false) {
  const document = await ensureCreditNoteForOrder(supabase, orderId, { force });
  if (!document) return null;
  const order = await loadOrderForInvoice(supabase, orderId);
  await sendInvoiceDocumentEmail(supabase, document, order);
  return document;
}
