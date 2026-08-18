import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLegacyProductLabel } from "@/lib/product-label";

type EmailKind = "confirmation" | "shipping" | "refund" | "cancellation" | "pickup_ready" | "pickup_completed";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

function money(value: unknown) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function sendResendEmail(input: { to: string; subject: string; html: string; idempotencyKey: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!input.to) return { skipped: true as const, reason: "missing_recipient" as const };
  if (!key || !from) return { skipped: true as const, reason: "email_not_configured" as const };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}: ${await response.text()}`);
  return { skipped: false as const, reason: "sent" as const };
}

async function loadOrder(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase.from("orders").select(`
    id,order_number,public_token,status,payment_status,payment_method,order_type,
    customer_first_name,customer_last_name,customer_email,customer_phone,notes,
    pickup_time,subtotal,discount_amount,promo_code,shipping_fee,total,shipping_method_name,
    shipping_address1,shipping_address2,shipping_postal_code,shipping_city,shipping_country,
    package_weight_g,tracking_carrier,tracking_number,tracking_url,
    confirmation_email_sent_at,shipping_email_sent_at,refund_email_sent_at,merchant_notification_sent_at,
    pickup_preparing_email_sent_at,pickup_ready_email_sent_at,pickup_completed_email_sent_at,
    order_items(id,product_name,quantity,unit_price,line_total,choices)
  `).eq("id", orderId).single();
  if (error || !data) throw error ?? new Error("Commande introuvable");
  return data as any;
}

async function loadSettings(supabase: SupabaseClient) {
  const { data } = await supabase.from("site_settings").select("key,value").in("key", ["brand_name", "support_email", "store_address", "opening_hours"]);
  return Object.fromEntries((data ?? []).map((row: any) => [row.key, String(row.value ?? "")])) as Record<string, string>;
}

function orderLines(order: any) {
  return (order.order_items ?? []).map((item: any) => {
    const choices = Array.isArray(item.choices) ? item.choices.map((c: any) => c?.label || c?.valueName || c?.value_name).filter(Boolean).join(" · ") : "";
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>${escapeHtml(item.quantity)} × ${escapeHtml(normalizeLegacyProductLabel(item.product_name, "fr"))}</strong>${choices ? `<div style="font-size:12px;color:#68756d;margin-top:3px">${escapeHtml(choices)}</div>` : ""}</td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right;white-space:nowrap">${escapeHtml(money(item.line_total))}</td></tr>`;
  }).join("");
}

function confirmationPaymentBadge(order: any) {
  if (order.payment_status !== "paid") return "";

  return `<div style="margin:14px 0 2px">
    <span style="display:inline-block;background:#edf4e9;border:1px solid #d7e5d4;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;color:#365a3d">
      Paiement confirmé
    </span>
  </div>`;
}

function confirmationSummary(order: any) {
  const hasDiscount = Number(order.discount_amount || 0) > 0;
  const pickup = order.order_type === "pickup";
  const fulfilmentLabel = pickup ? "Retrait boutique" : "Livraison";
  const fulfilmentValue = pickup
    ? "Offert"
    : Number(order.shipping_fee || 0) > 0
      ? money(order.shipping_fee)
      : "Offerte";

  return `<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:18px;border-top:1px solid #e7e2d8">
    ${
      hasDiscount
        ? `<tr>
            <td style="padding:18px 12px 0 0;color:#486a4b;line-height:1.4">Code promo ${escapeHtml(order.promo_code || "")}</td>
            <td style="padding:18px 0 0 12px;text-align:right;color:#486a4b;font-weight:700;white-space:nowrap;line-height:1.4">− ${escapeHtml(money(order.discount_amount))}</td>
          </tr>`
        : ""
    }
    <tr>
      <td style="padding:14px 12px 0 0;color:#59665f;line-height:1.4">${fulfilmentLabel}</td>
      <td style="padding:14px 0 0 12px;text-align:right;font-weight:700;white-space:nowrap;line-height:1.4">${escapeHtml(fulfilmentValue)}</td>
    </tr>
    <tr>
      <td style="padding:14px 12px 0 0;font-size:20px;font-weight:700;line-height:1.3">Total</td>
      <td style="padding:14px 0 0 12px;text-align:right;font-size:20px;font-weight:700;white-space:nowrap;line-height:1.3">${escapeHtml(money(order.total))}</td>
    </tr>
  </table>`;
}

function shell(brand: string, title: string, intro: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f2e8;color:#26362d;font-family:Arial,sans-serif;-webkit-text-size-adjust:100%"><div style="width:100%;max-width:640px;margin:0 auto;padding:28px 18px;box-sizing:border-box"><div style="width:100%;box-sizing:border-box;background:#fffdf8;border:1px solid #e7e2d8;border-radius:22px;padding:28px"><div style="font-size:12px;letter-spacing:.18em;font-weight:700;color:#486a4b">${escapeHtml(brand)}</div><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:10px 0 12px">${escapeHtml(title)}</h1><p style="line-height:1.6;color:#59665f;margin:0 0 6px">${escapeHtml(intro)}</p>${body}</div></div></body></html>`;
}

export async function sendOrderEmail(
  supabase: SupabaseClient,
  orderId: string,
  kind: EmailKind,
  options: { force?: boolean; idempotencySuffix?: string } = {},
) {
  const order = await loadOrder(supabase, orderId);
  if (!order.customer_email) return { skipped: true as const, reason: "missing_recipient" as const };
  const timestampField =
    kind === "confirmation"
      ? "confirmation_email_sent_at"
      : kind === "shipping"
        ? "shipping_email_sent_at"
        : kind === "refund"
          ? "refund_email_sent_at"
          : kind === "pickup_ready"
            ? "pickup_ready_email_sent_at"
            : kind === "pickup_completed"
              ? "pickup_completed_email_sent_at"
              : null;
  if (timestampField && order[timestampField] && !options.force) {
    return { skipped: true as const, reason: "already_sent" as const };
  }

  const settings = await loadSettings(supabase);
  const brand = settings.brand_name || "ICHIGO ICHIE";
  const trackingPage = `${siteOrigin()}/commande/${order.public_token}`;
  let subject = "";
  let html = "";

  if (kind === "confirmation") {
    subject = `${brand} · Confirmation ${order.order_number}`;
    const destination = order.order_type === "shipping"
      ? `<p style="line-height:1.6"><strong>Livraison</strong><br>${escapeHtml(order.shipping_method_name || "Livraison à domicile")}<br>${escapeHtml([order.shipping_address1, order.shipping_address2, `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim()].filter(Boolean).join(" · "))}</p>`
      : `<p style="line-height:1.6"><strong>Retrait boutique</strong><br>${escapeHtml(order.pickup_time ? new Date(order.pickup_time).toLocaleString("fr-FR") : "Dès que possible")}<br>${escapeHtml(settings.store_address || "Nice")}</p>`;
    const pickupPreparationNotice = order.order_type === "pickup"
      ? `<div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:18px 0;line-height:1.6">
          <strong>Notre équipe va maintenant préparer votre commande.</strong>
          <div style="margin-top:7px;color:#59665f">Nous vous enverrons un nouvel e-mail dès qu’elle sera prête à être retirée en boutique.</div>
          <div style="margin-top:7px;color:#59665f">Merci d’attendre cette confirmation avant de vous déplacer.</div>
        </div>`
      : "";
    html = shell(brand, "Votre commande est confirmée", `Bonjour ${order.customer_first_name || ""}, nous avons bien reçu votre commande ${order.order_number}.`, `
      ${confirmationPaymentBadge(order)}
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0">${orderLines(order)}</table>
      ${destination}
      ${pickupPreparationNotice}
      ${confirmationSummary(order)}
      <p style="margin:24px 0 0"><a href="${escapeHtml(trackingPage)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Voir ma commande</a></p>`);
  } else if (kind === "shipping") {
    subject = `${brand} · Votre commande ${order.order_number} a été expédiée`;
    const carrier = order.tracking_carrier || "Transporteur";
    const tracking = order.tracking_number || "";
    const trackingUrl = order.tracking_url || trackingPage;
    html = shell(brand, "Votre colis est en route", `La commande ${order.order_number} a été remise au transporteur.`, `
      <div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:22px 0"><strong>${escapeHtml(carrier)}</strong>${tracking ? `<div style="margin-top:8px">N° de suivi : <strong>${escapeHtml(tracking)}</strong></div>` : ""}</div>
      <p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">Suivre mon colis</a></p>`);
  } else if (kind === "pickup_ready") {
    const storeAddress = settings.store_address || "14 rue Centrale, 06300 Nice";
    const openingHours = settings.opening_hours || "Consultez les horaires à jour sur notre site";
    const pickupSlot = order.pickup_time
      ? new Date(order.pickup_time).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
      : "";
    subject = `${brand} · Votre commande ${order.order_number} est prête`;
    html = shell(
      brand,
      "Votre commande est prête à retirer",
      `Bonne nouvelle ${order.customer_first_name || ""} ! Votre commande ${order.order_number} a été préparée.`,
      `
      <div style="background:#edf4e9;border-radius:16px;padding:20px;margin:22px 0;line-height:1.6">
        <strong style="font-size:17px">Vous pouvez venir récupérer votre commande.</strong>
        ${pickupSlot ? `<div style="margin-top:12px"><strong>Créneau prévu</strong><br>${escapeHtml(pickupSlot)}</div>` : ""}
        <div style="margin-top:12px"><strong>Adresse</strong><br>${escapeHtml(storeAddress)}</div>
        <div style="margin-top:12px"><strong>Horaires d’ouverture</strong><br>${escapeHtml(openingHours)}</div>
      </div>
      <p style="line-height:1.6;color:#59665f">Présentez simplement le numéro de commande <strong>${escapeHtml(order.order_number)}</strong> lors de votre arrivée.</p>
      <p style="margin-top:24px"><a href="${escapeHtml(trackingPage)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">Voir ma commande</a></p>`
    );
  } else if (kind === "pickup_completed") {
    subject = `${brand} · Merci pour votre commande ${order.order_number}`;
    html = shell(
      brand,
      "Merci et à bientôt",
      `Bonjour ${order.customer_first_name || ""}, votre commande ${order.order_number} a bien été remise.`,
      `
      <div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:22px 0;line-height:1.6">
        <strong>Merci d’avoir choisi ${escapeHtml(brand)}.</strong>
        <div style="margin-top:7px;color:#59665f">Nous espérons que vous apprécierez votre commande et serons ravis de vous accueillir de nouveau.</div>
        <div style="margin-top:12px;color:#59665f">Votre facture est disponible dans le suivi de votre commande. Vous pouvez la télécharger quand vous le souhaitez.</div>
      </div>
      <p style="margin-top:24px"><a href="${escapeHtml(trackingPage)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">Voir ma commande</a></p>`
    );
  } else if (kind === "cancellation") {
    subject = `${brand} · Commande ${order.order_number} annulée`;
    html = shell(
      brand,
      "Votre commande a été annulée",
      `Bonjour ${order.customer_first_name || ""}, la commande ${order.order_number} a bien été annulée.`,
      `
      <div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:22px 0">
        <strong>Aucun paiement n’a été encaissé.</strong>
        <div style="margin-top:6px;color:#59665f;line-height:1.5">
          Les articles réservés pour cette commande ont été libérés.
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:22px 0">${orderLines(order)}</table>
      <p style="margin-top:24px">
        <a href="${escapeHtml(`${siteOrigin()}/#boutique`)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">
          Retour à la boutique
        </a>
      </p>`
    );
  } else {
    subject = `${brand} · Remboursement ${order.order_number}`;
    html = shell(
      brand,
      "Remboursement confirmé",
      `Le remboursement de la commande ${order.order_number} a été confirmé.`,
      `<p style="font-size:22px"><strong>${money(order.total)}</strong></p><p>Le délai d’apparition sur votre compte dépend ensuite de votre banque et du moyen de paiement.</p>`
    );
  }

  const idempotencySuffix = options.idempotencySuffix
    ? `-${options.idempotencySuffix}`
    : "";
  const sent = await sendResendEmail({
    to: order.customer_email,
    subject,
    html,
    idempotencyKey: `${kind}-${order.id}${idempotencySuffix}`,
  });

  if (!sent.skipped && timestampField) {
    const sentAt = new Date().toISOString();
    if (options.force) {
      await supabase
        .from("orders")
        .update({ [timestampField]: sentAt })
        .eq("id", order.id);
    } else {
      await supabase
        .from("orders")
        .update({ [timestampField]: sentAt })
        .eq("id", order.id)
        .is(timestampField, null);
    }
  }
  return sent;
}


function notificationRecipients(settings: Record<string, string>) {
  const configured = process.env.ORDER_NOTIFICATION_EMAIL?.trim() || settings.support_email?.trim() || "";
  return configured
    .split(/[;,]/)
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, values) => /^\S+@\S+\.\S+$/.test(email) && values.indexOf(email) === index)
    .slice(0, 10);
}

function adminOrderDestination(order: any) {
  if (order.order_type === "shipping") {
    return `<div style="margin-top:16px;padding:16px;background:#f5f2e8;border-radius:14px"><strong>Livraison à domicile</strong><br>${escapeHtml(order.shipping_method_name || "Livraison")}<br>${escapeHtml([order.shipping_address1, order.shipping_address2, `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim()].filter(Boolean).join(" · "))}</div>`;
  }
  return `<div style="margin-top:16px;padding:16px;background:#f5f2e8;border-radius:14px"><strong>Retrait boutique</strong><br>${escapeHtml(order.pickup_time ? new Date(order.pickup_time).toLocaleString("fr-FR") : "Dès que possible")}</div>`;
}

/**
 * Internal alert for the shop team. It is intentionally sent only after Stripe
 * confirms payment, so abandoned/unpaid checkout sessions do not create noise.
 */
export async function sendMerchantOrderNotification(supabase: SupabaseClient, orderId: string) {
  const order = await loadOrder(supabase, orderId);
  if (order.merchant_notification_sent_at) return { skipped: true };

  const settings = await loadSettings(supabase);
  const recipients = notificationRecipients(settings);
  if (!recipients.length) return { skipped: true };

  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!key || !from) return { skipped: true };

  const brand = settings.brand_name || "ICHIGO ICHIE";
  const customerName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || "Client";
  const promoRow = Number(order.discount_amount || 0) > 0
    ? `<div style="display:flex;justify-content:space-between;margin-top:8px;color:#486a4b"><span>Promo ${escapeHtml(order.promo_code || "")}</span><strong>− ${money(order.discount_amount)}</strong></div>`
    : "";
  const noteRow = order.notes
    ? `<div style="margin-top:16px;padding:16px;border:1px solid #e7e2d8;border-radius:14px"><strong>Note client</strong><div style="margin-top:8px;white-space:pre-wrap">${escapeHtml(order.notes)}</div></div>`
    : "";
  const adminUrl = `${siteOrigin()}/admin`;
  const trackingUrl = `${siteOrigin()}/commande/${order.public_token}`;
  const html = shell(brand, "Nouvelle commande payée", `${order.order_number} · ${money(order.total)}`, `
    <div style="margin:20px 0 10px"><strong>${escapeHtml(customerName)}</strong><br>${escapeHtml(order.customer_email || "")}${order.customer_phone ? `<br>${escapeHtml(order.customer_phone)}` : ""}</div>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${orderLines(order)}</table>
    ${adminOrderDestination(order)}
    ${noteRow}
    <div style="margin-top:18px;padding-top:18px;border-top:1px solid #e7e2d8">
      <div style="display:flex;justify-content:space-between"><span>Sous-total</span><strong>${money(order.subtotal)}</strong></div>
      ${promoRow}
      <div style="display:flex;justify-content:space-between;margin-top:8px"><span>Livraison</span><strong>${Number(order.shipping_fee || 0) > 0 ? money(order.shipping_fee) : "0,00 €"}</strong></div>
      <div style="display:flex;justify-content:space-between;font-size:22px;margin-top:12px"><strong>Total payé</strong><strong>${money(order.total)}</strong></div>
    </div>
    <p style="margin-top:24px"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;margin-right:8px">Ouvrir l’admin</a> <a href="${escapeHtml(trackingUrl)}" style="display:inline-block;color:#294237;text-decoration:none;padding:12px 0">Voir la commande</a></p>`);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `merchant-paid-${order.id}`.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `🛍️ Nouvelle commande payée · ${order.order_number} · ${money(order.total)}`,
      html,
    }),
  });
  if (!response.ok) throw new Error(`RESEND_${response.status}: ${await response.text()}`);

  await supabase
    .from("orders")
    .update({ merchant_notification_sent_at: new Date().toISOString() })
    .eq("id", order.id)
    .is("merchant_notification_sent_at", null);
  return { skipped: false };
}
