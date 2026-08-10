import type { SupabaseClient } from "@supabase/supabase-js";

type EmailKind = "confirmation" | "shipping" | "refund";

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
  if (!key || !from || !input.to) return { skipped: true as const };
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
  return { skipped: false as const };
}

async function loadOrder(supabase: SupabaseClient, orderId: string) {
  const { data, error } = await supabase.from("orders").select(`
    id,order_number,public_token,status,payment_status,payment_method,order_type,
    customer_first_name,customer_last_name,customer_email,customer_phone,notes,
    pickup_time,subtotal,discount_amount,promo_code,shipping_fee,total,shipping_method_name,
    shipping_address1,shipping_address2,shipping_postal_code,shipping_city,shipping_country,
    package_weight_g,tracking_carrier,tracking_number,tracking_url,
    confirmation_email_sent_at,shipping_email_sent_at,refund_email_sent_at,merchant_notification_sent_at,
    order_items(id,product_name,quantity,unit_price,line_total,choices)
  `).eq("id", orderId).single();
  if (error || !data) throw error ?? new Error("Commande introuvable");
  return data as any;
}

async function loadSettings(supabase: SupabaseClient) {
  const { data } = await supabase.from("site_settings").select("key,value").in("key", ["brand_name", "support_email", "store_address"]);
  return Object.fromEntries((data ?? []).map((row: any) => [row.key, String(row.value ?? "")])) as Record<string, string>;
}

function orderLines(order: any) {
  return (order.order_items ?? []).map((item: any) => {
    const choices = Array.isArray(item.choices) ? item.choices.map((c: any) => c?.label || c?.valueName || c?.value_name).filter(Boolean).join(" · ") : "";
    return `<tr><td style="padding:10px 0;border-bottom:1px solid #e7e2d8"><strong>${escapeHtml(item.quantity)} × ${escapeHtml(item.product_name)}</strong>${choices ? `<div style="font-size:12px;color:#68756d;margin-top:3px">${escapeHtml(choices)}</div>` : ""}</td><td style="padding:10px 0;border-bottom:1px solid #e7e2d8;text-align:right;white-space:nowrap">${escapeHtml(money(item.line_total))}</td></tr>`;
  }).join("");
}

function shell(brand: string, title: string, intro: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f5f2e8;color:#26362d;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#fffdf8;border:1px solid #e7e2d8;border-radius:22px;padding:28px"><div style="font-size:12px;letter-spacing:.18em;font-weight:700;color:#486a4b">${escapeHtml(brand)}</div><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:10px 0 12px">${escapeHtml(title)}</h1><p style="line-height:1.6;color:#59665f">${escapeHtml(intro)}</p>${body}</div></div></body></html>`;
}

export async function sendOrderEmail(supabase: SupabaseClient, orderId: string, kind: EmailKind) {
  const order = await loadOrder(supabase, orderId);
  if (!order.customer_email) return { skipped: true };
  const timestampField = kind === "confirmation" ? "confirmation_email_sent_at" : kind === "shipping" ? "shipping_email_sent_at" : "refund_email_sent_at";
  if (order[timestampField]) return { skipped: true };

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
    html = shell(brand, "Votre commande est confirmée", `Bonjour ${order.customer_first_name || ""}, nous avons bien reçu votre commande ${order.order_number}.`, `
      <table style="width:100%;border-collapse:collapse;margin:22px 0">${orderLines(order)}</table>
      ${destination}
      <div style="margin-top:18px;padding-top:18px;border-top:1px solid #e7e2d8">${Number(order.discount_amount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#486a4b"><span>Code promo ${escapeHtml(order.promo_code || "")}</span><strong>− ${money(order.discount_amount)}</strong></div>` : ""}<div style="display:flex;justify-content:space-between"><span>Livraison</span><strong>${order.shipping_fee ? money(order.shipping_fee) : "Offerte / retrait"}</strong></div><div style="display:flex;justify-content:space-between;font-size:20px;margin-top:10px"><strong>Total</strong><strong>${money(order.total)}</strong></div></div>
      <p style="margin-top:24px"><a href="${escapeHtml(trackingPage)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">Suivre ma commande</a></p>`);
  } else if (kind === "shipping") {
    subject = `${brand} · Votre commande ${order.order_number} a été expédiée`;
    const carrier = order.tracking_carrier || "Transporteur";
    const tracking = order.tracking_number || "";
    const trackingUrl = order.tracking_url || trackingPage;
    html = shell(brand, "Votre colis est en route", `La commande ${order.order_number} a été remise au transporteur.`, `
      <div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:22px 0"><strong>${escapeHtml(carrier)}</strong>${tracking ? `<div style="margin-top:8px">N° de suivi : <strong>${escapeHtml(tracking)}</strong></div>` : ""}</div>
      <p><a href="${escapeHtml(trackingUrl)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">Suivre mon colis</a></p>`);
  } else {
    subject = `${brand} · Remboursement ${order.order_number}`;
    html = shell(brand, "Remboursement confirmé", `Le remboursement de la commande ${order.order_number} a été demandé auprès du moyen de paiement utilisé.`, `<p style="font-size:22px"><strong>${money(order.total)}</strong></p><p>Le délai d’apparition sur votre compte dépend ensuite de votre banque et du moyen de paiement.</p>`);
  }

  const sent = await sendResendEmail({ to: order.customer_email, subject, html, idempotencyKey: `${kind}-${order.id}` });
  if (!sent.skipped) await supabase.from("orders").update({ [timestampField]: new Date().toISOString() }).eq("id", order.id).is(timestampField, null);
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
