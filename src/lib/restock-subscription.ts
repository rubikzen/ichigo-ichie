import { createHmac, timingSafeEqual } from "node:crypto";

type RestockLocale = "fr" | "en";

function restockSecret() {
  const value =
    process.env.RESTOCK_UNSUBSCRIBE_SECRET?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!value) throw new Error("RESTOCK_UNSUBSCRIBE_SECRET_MISSING");
  return value;
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char] || char));
}

export function createRestockManageToken(subscriptionId: string) {
  return createHmac("sha256", restockSecret())
    .update(`ichigo-restock:${subscriptionId}`)
    .digest("hex");
}

export function verifyRestockManageToken(subscriptionId: string, candidate: string) {
  if (!/^[0-9a-f]{64}$/i.test(candidate)) return false;
  const expected = Buffer.from(createRestockManageToken(subscriptionId), "hex");
  const received = Buffer.from(candidate, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function restockManageUrl(subscriptionId: string, locale: RestockLocale) {
  const params = new URLSearchParams({
    id: subscriptionId,
    token: createRestockManageToken(subscriptionId),
    lang: locale,
  });
  return `${siteOrigin()}/restock/desinscription?${params.toString()}`;
}

export async function sendRestockSubscriptionConfirmation(input: {
  subscriptionId: string;
  email: string;
  locale: RestockLocale;
  productName: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!input.email) return { skipped: true as const, reason: "missing_recipient" as const };
  if (!key || !from) return { skipped: true as const, reason: "email_not_configured" as const };

  const fr = input.locale === "fr";
  const manageUrl = restockManageUrl(input.subscriptionId, input.locale);
  const title = fr ? "Votre alerte est enregistrée" : "Your alert is saved";
  const intro = fr
    ? `Nous vous préviendrons lorsque ${input.productName} sera de retour en stock.`
    : `We'll let you know when ${input.productName} is back in stock.`;
  const manageLabel = fr ? "Gérer cette alerte" : "Manage this alert";
  const note = fr
    ? "Cette alerte concerne uniquement ce produit. Vous pouvez l’annuler à tout moment depuis le lien ci-dessus."
    : "This alert only applies to this product. You can cancel it at any time from the link above.";
  const subject = fr
    ? `ICHIGO ICHIE · Alerte enregistrée pour ${input.productName}`
    : `ICHIGO ICHIE · Restock alert saved for ${input.productName}`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f2e8;color:#26362d;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#fffdf8;border:1px solid #e7e2d8;border-radius:22px;padding:28px"><div style="font-size:12px;letter-spacing:.18em;font-weight:700;color:#486a4b">ICHIGO ICHIE</div><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:10px 0 12px">${escapeHtml(title)}</h1><p style="line-height:1.65;color:#59665f">${escapeHtml(intro)}</p><p style="margin:24px 0"><a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">${escapeHtml(manageLabel)}</a></p><p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e7e2d8;color:#7a837d;font-size:11px;line-height:1.55">${escapeHtml(note)}</p></div></div></body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `restock-confirmation-${input.subscriptionId}`.slice(0, 256),
    },
    body: JSON.stringify({ from, to: [input.email], subject, html }),
  });

  if (!response.ok) {
    throw new Error(`RESEND_RESTOCK_CONFIRMATION_${response.status}: ${await response.text()}`);
  }
  return { skipped: false as const, reason: "sent" as const };
}
