import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStripeServer } from "@/lib/stripe";
import { getInvoiceConfig, validateInvoiceConfig } from "@/lib/invoice";
import {
  getCommerceEnvironment,
  stripeEnvironmentIsConsistent,
  stripePublishableMode,
  stripeSecretMode,
} from "@/lib/runtime-environment";
import {
  collectCommerceHealth,
  type CommerceHealth,
} from "@/lib/commerce-health";

type CheckStatus = "ok" | "warning" | "error";
type Check = { id: string; label: string; status: CheckStatus; detail: string; blocker?: boolean };

function configured(value: unknown) {
  return Boolean(String(value || "").trim());
}

function safeOrigin() {
  return String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
}

async function countRows(supabase: any, environment: string, archived: boolean) {
  let query = supabase.from("orders").select("id", { count: "exact", head: true }).eq("environment", environment);
  query = archived ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const environment = getCommerceEnvironment();
    const secretMode = stripeSecretMode();
    const publicMode = stripePublishableMode();
    const origin = safeOrigin();
    const isHttps = /^https:\/\//i.test(origin);
    const isLocal = /localhost|127\.0\.0\.1/i.test(origin);
    const checks: Check[] = [];

    const { error: dbError } = await supabase.from("orders").select("id").limit(1);
    checks.push(dbError
      ? { id: "database", label: "Supabase", status: "error", blocker: true, detail: dbError.message }
      : { id: "database", label: "Supabase", status: "ok", detail: "Connexion base de données opérationnelle." });

    const stripe = getStripeServer();
    if (!stripe) {
      checks.push({ id: "stripe", label: "Stripe", status: "error", blocker: true, detail: "STRIPE_SECRET_KEY manquante." });
    } else {
      try {
        await stripe.checkout.sessions.list({ limit: 1 });
        checks.push({ id: "stripe", label: "Stripe", status: "ok", detail: `API Stripe joignable · mode ${secretMode}.` });
      } catch (error) {
        checks.push({ id: "stripe", label: "Stripe", status: "error", blocker: true, detail: error instanceof Error ? error.message : "Connexion Stripe impossible." });
      }
    }

    checks.push(stripeEnvironmentIsConsistent()
      ? { id: "stripe_keys", label: "Clés Stripe", status: "ok", detail: `Publishable + secret utilisent toutes deux le mode ${environment}.` }
      : { id: "stripe_keys", label: "Clés Stripe", status: "error", blocker: true, detail: `Clés incohérentes ou manquantes : publishable=${publicMode}, secret=${secretMode}.` });

    const webhook = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    checks.push(webhook.startsWith("whsec_")
      ? { id: "webhook", label: "Webhook Stripe", status: "ok", detail: environment === "test" ? "Secret webhook configuré pour les tests locaux." : "Secret webhook configuré." }
      : { id: "webhook", label: "Webhook Stripe", status: "error", blocker: true, detail: "STRIPE_WEBHOOK_SECRET manquant ou invalide." });

    const resendKey = String(process.env.RESEND_API_KEY || "").trim();
    const emailFrom = String(process.env.EMAIL_FROM || "").trim();
    const merchantEmail = String(process.env.ORDER_NOTIFICATION_EMAIL || "").trim();
    checks.push(resendKey.startsWith("re_") && resendKey.length > 12 && emailFrom.includes("@") && merchantEmail.includes("@")
      ? { id: "email", label: "E-mails", status: "ok", detail: "Resend, expéditeur et notification boutique configurés." }
      : { id: "email", label: "E-mails", status: "warning", detail: "Vérifiez RESEND_API_KEY, EMAIL_FROM et ORDER_NOTIFICATION_EMAIL avant la mise en ligne." });

    checks.push(origin
      ? (isHttps && !isLocal
        ? { id: "https", label: "URL production", status: "ok", detail: origin }
        : { id: "https", label: "URL production", status: environment === "live" ? "error" : "warning", blocker: environment === "live", detail: `${origin} · HTTPS sera obligatoire en production.` })
      : { id: "https", label: "URL production", status: "error", blocker: true, detail: "NEXT_PUBLIC_SITE_URL manquante." });

    try {
      const invoiceConfig = await getInvoiceConfig(supabase);
      if (!invoiceConfig.enabled) {
        checks.push({ id: "invoice", label: "Facturation", status: "error", blocker: true, detail: "Facturation automatique désactivée. Activez-la après avoir validé les mentions légales et la TVA." });
      } else {
        validateInvoiceConfig(invoiceConfig);
        const { data: shopCategories, error: categoryError } = await supabase.from("categories").select("id").eq("kind", "shop");
        if (categoryError) throw categoryError;
        const categoryIds = (shopCategories ?? []).map((row: any) => row.id);
        const { data: shopProducts, error: productError } = categoryIds.length
          ? await supabase.from("products").select("name_fr,vat_rate").in("category_id", categoryIds).eq("active", true)
          : { data: [], error: null } as any;
        if (productError) throw productError;
        const missingVat = (shopProducts ?? []).filter((row: any) => row.vat_rate == null || String(row.vat_rate).trim() === "");
        checks.push(missingVat.length
          ? { id: "invoice", label: "Facturation", status: "error", blocker: true, detail: `TVA manquante : ${missingVat.slice(0, 4).map((row: any) => row.name_fr).join(", ")}${missingVat.length > 4 ? "…" : ""}` }
          : { id: "invoice", label: "Facturation", status: "ok", detail: "Configuration légale et TVA produits actives complètes." });
      }
    } catch (error) {
      checks.push({ id: "invoice", label: "Facturation", status: "error", blocker: true, detail: error instanceof Error ? error.message : "Configuration facture invalide." });
    }

    let dataCounts = { test: 0, live: 0, legacy: 0, archivedTest: 0 };
    try {
      const [test, live, legacy, archivedTest] = await Promise.all([
        countRows(supabase, "test", false),
        countRows(supabase, "live", false),
        countRows(supabase, "legacy", false),
        countRows(supabase, "test", true),
      ]);
      dataCounts = { test, live, legacy, archivedTest };
      checks.push(legacy > 0
        ? { id: "legacy", label: "Données historiques", status: "warning", blocker: true, detail: `${legacy} commande(s) non classée(s) test/live. Classez-les avant le passage en LIVE pour séparer proprement les numéros de facture.` }
        : { id: "legacy", label: "Données historiques", status: "ok", detail: "Toutes les commandes sont classées test ou live." });
    } catch (error) {
      checks.push({ id: "legacy", label: "Données historiques", status: "warning", detail: error instanceof Error ? error.message : "Comptage indisponible." });
    }

    let commerceHealth: CommerceHealth | null = null;
    try {
      commerceHealth = await collectCommerceHealth(supabase, environment);
      const reservationProblems =
        commerceHealth.summary.reservationIssueCount +
        commerceHealth.summary.promoMismatchCount;

      checks.push(
        reservationProblems
          ? {
              id: "reservations",
              label: "Réservations",
              status: "error",
              blocker: true,
              detail: `${commerceHealth.summary.reservationIssueCount} commande(s) à vérifier · ${commerceHealth.summary.stockReservationLeaks} réservation(s) stock · ${commerceHealth.summary.promoReservationLeaks} réservation(s) promo · ${commerceHealth.summary.promoMismatchCount} compteur(s) promo incohérent(s).`,
            }
          : {
              id: "reservations",
              label: "Réservations",
              status: "ok",
              detail: "Aucune réservation stock/promo obsolète détectée.",
            },
      );

      const stockWarnings =
        commerceHealth.summary.outOfStock + commerceHealth.summary.lowStock;
      checks.push(
        stockWarnings
          ? {
              id: "inventory",
              label: "Stock Boutique",
              status: "warning",
              detail: `${commerceHealth.summary.outOfStock} rupture(s) · ${commerceHealth.summary.lowStock} stock(s) faible(s) (≤ 3).`,
            }
          : {
              id: "inventory",
              label: "Stock Boutique",
              status: "ok",
              detail: "Aucune rupture ni stock faible sur les produits Boutique actifs.",
            },
      );
    } catch (error) {
      checks.push({
        id: "reservations",
        label: "Réservations",
        status: "error",
        blocker: true,
        detail:
          error instanceof Error
            ? `Diagnostic stock/réservations indisponible : ${error.message}`
            : "Diagnostic stock/réservations indisponible.",
      });
    }

    const blocking = checks.filter((check) => check.blocker && check.status !== "ok");
    const readyForLiveSwitch = blocking.length === 0;
    const productionReady = readyForLiveSwitch && environment === "live" && isHttps && !isLocal;

    return NextResponse.json({
      environment,
      stripe: { secretMode, publishableMode: publicMode },
      origin,
      checks,
      dataCounts,
      commerceHealth,
      readyForLiveSwitch,
      productionReady,
      generatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error?.message || "Diagnostic système impossible." }, { status });
  }
}
