function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] || char,
  );
}

function siteOrigin() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

async function sendResend(input: {
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!input.to) return { sent: false as const, reason: "missing_recipient" as const };
  if (!apiKey || !from) return { sent: false as const, reason: "email_not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "Idempotency-Key": input.idempotencyKey.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: input.replyTo || undefined,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) throw new Error(`RESEND_${response.status}: ${(await response.text()).slice(0, 600)}`);
  return { sent: true as const, reason: "sent" as const };
}

export type WithdrawalEmailInput = {
  id: string;
  requestNumber: string;
  orderNumber: string;
  firstName: string;
  lastName: string;
  acknowledgementEmail: string;
  submittedAt: string;
  scope: "full" | "partial";
  selectedItems: Array<{ id: string; productName: string; quantity: number }>;
  customerNote: string;
};

function itemLines(input: WithdrawalEmailInput) {
  return input.selectedItems
    .map((item) => `<li>${escapeHtml(item.quantity)} × ${escapeHtml(item.productName)}</li>`)
    .join("");
}

export async function sendWithdrawalAcknowledgement(input: WithdrawalEmailInput) {
  const when = new Date(input.submittedAt).toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  });
  const html = `<!doctype html><html><body style="margin:0;background:#f5f2e8;color:#26362d;font-family:Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px"><div style="background:#fffdf8;border:1px solid #e7e2d8;border-radius:22px;padding:28px"><div style="font-size:12px;letter-spacing:.18em;font-weight:700;color:#486a4b">ICHIGO ICHIE</div><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:10px 0 12px">Accusé de réception de votre rétractation</h1><p style="line-height:1.6">Bonjour ${escapeHtml(input.firstName)},</p><p style="line-height:1.6">Nous confirmons la réception de votre déclaration de rétractation.</p><div style="background:#f5f2e8;border-radius:16px;padding:18px;margin:20px 0;line-height:1.6"><strong>Référence :</strong> ${escapeHtml(input.requestNumber)}<br><strong>Commande :</strong> ${escapeHtml(input.orderNumber)}<br><strong>Date et heure de réception :</strong> ${escapeHtml(when)}<br><strong>Portée :</strong> ${input.scope === "full" ? "commande complète" : "articles sélectionnés"}</div><strong>Articles concernés</strong><ul style="line-height:1.7">${itemLines(input)}</ul>${input.customerNote ? `<p style="line-height:1.6"><strong>Votre note :</strong><br>${escapeHtml(input.customerNote)}</p>` : ""}<p style="line-height:1.6;color:#59665f">Cet accusé confirme la réception de votre déclaration. Il ne préjuge pas de l’applicabilité d’une exception légale, de l’état des biens retournés ni du montant final éventuellement remboursable.</p><p style="margin-top:24px"><a href="${escapeHtml(siteOrigin())}/retractation" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Rétractation en ligne</a></p></div></div></body></html>`;

  return sendResend({
    to: input.acknowledgementEmail,
    subject: `ICHIGO ICHIE · Rétractation ${input.requestNumber}`,
    html,
    idempotencyKey: `withdrawal-ack-${input.id}`,
  });
}

export async function sendWithdrawalMerchantNotification(
  input: WithdrawalEmailInput,
  recipient: string,
) {
  if (!recipient) return { sent: false as const, reason: "missing_recipient" as const };

  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#26362d"><h2>Nouvelle demande de rétractation</h2><p><strong>Référence :</strong> ${escapeHtml(input.requestNumber)}</p><p><strong>Commande :</strong> ${escapeHtml(input.orderNumber)}</p><p><strong>Client :</strong> ${escapeHtml([input.firstName, input.lastName].filter(Boolean).join(" "))}</p><p><strong>E-mail accusé :</strong> ${escapeHtml(input.acknowledgementEmail)}</p><p><strong>Articles :</strong></p><ul>${itemLines(input)}</ul>${input.customerNote ? `<p><strong>Note :</strong><br>${escapeHtml(input.customerNote)}</p>` : ""}<p>À traiter dans Administration → Aujourd’hui → Rétractations.</p></div>`;

  return sendResend({
    to: recipient,
    replyTo: input.acknowledgementEmail,
    subject: `Rétractation ${input.requestNumber} · ${input.orderNumber}`,
    html,
    idempotencyKey: `withdrawal-merchant-${input.id}`,
  });
}
