import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit, PublicApiError, readJsonBody, tooManyRequests } from "@/lib/public-api";

export const runtime = "nodejs";

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}
function settingString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return value == null ? "" : String(value);
}
function isEnabled(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return value !== "false" && value !== "0";
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
    const rateLimit = await consumeRateLimit(request, supabase, { scope: "contact:submit", limit: 5, windowSeconds: 600 });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);
    const body = await readJsonBody<Record<string, unknown>>(request, 24_000);

    // Invisible honeypot: bots usually fill this field. Return success without storing it.
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });

    const firstName = clean(body.firstName, 100);
    const lastName = clean(body.lastName, 100);
    const email = clean(body.email, 180).toLowerCase();
    const phone = clean(body.phone, 60);
    const message = clean(body.message, 4000);
    const locale = clean(body.locale, 2) === "en" ? "en" : "fr";

    const keys = ["contact_first_name_required", "contact_last_name_required", "contact_email_required", "contact_phone_required", "contact_message_required", "support_email"];
    const { data: settingRows } = await supabase.from("site_settings").select("key,value").in("key", keys);
    const settings = Object.fromEntries((settingRows ?? []).map((row) => [row.key, settingString(row.value)]));

    if (isEnabled(settings.contact_first_name_required, true) && !firstName) return NextResponse.json({ error: locale === "fr" ? "Prénom requis." : "First name is required." }, { status: 400 });
    if (isEnabled(settings.contact_last_name_required, false) && !lastName) return NextResponse.json({ error: locale === "fr" ? "Nom requis." : "Last name is required." }, { status: 400 });
    if (isEnabled(settings.contact_email_required, true) && !email) return NextResponse.json({ error: locale === "fr" ? "E-mail requis." : "Email is required." }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: locale === "fr" ? "E-mail invalide." : "Invalid email." }, { status: 400 });
    if (isEnabled(settings.contact_phone_required, false) && !phone) return NextResponse.json({ error: locale === "fr" ? "Téléphone requis." : "Phone is required." }, { status: 400 });
    if (isEnabled(settings.contact_message_required, true) && !message) return NextResponse.json({ error: locale === "fr" ? "Message requis." : "Message is required." }, { status: 400 });
    if (message && message.length < 3) return NextResponse.json({ error: locale === "fr" ? "Message trop court." : "Message is too short." }, { status: 400 });

    const { data: inserted, error } = await supabase.from("contact_messages").insert({ first_name: firstName, last_name: lastName, email, phone, message, locale, status: "new" }).select("id").single();
    if (error || !inserted) throw error ?? new Error("CONTACT_INSERT_FAILED");

    // Optional notification: reuses the Resend configuration already introduced in V2.27.
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.EMAIL_FROM?.trim();
    const to = process.env.CONTACT_NOTIFICATION_EMAIL?.trim() || settings.support_email?.trim();
    if (apiKey && from && to) {
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Visiteur du site";
      const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#26362d"><h2>Nouveau message — Ichigo Ichie</h2><p><strong>De :</strong> ${escapeHtml(fullName)}</p><p><strong>E-mail :</strong> ${escapeHtml(email || "—")}</p><p><strong>Téléphone :</strong> ${escapeHtml(phone || "—")}</p><p><strong>Message :</strong></p><p style="white-space:pre-wrap">${escapeHtml(message)}</p></div>`;
      try {
        await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [to], reply_to: email || undefined, subject: `Nouveau message contact — ${fullName}`, html }) });
      } catch (notificationError) {
        console.error("Contact notification email error", notificationError);
      }
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    console.error("Contact form error", error);
    if (error instanceof PublicApiError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Impossible d’envoyer le message pour le moment." }, { status: 500 });
  }
}
