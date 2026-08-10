"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";

function enabled(value: string | undefined, fallback = false) {
  if (value == null || value === "") return fallback;
  return value !== "false" && value !== "0";
}

export function ContactSection() {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const [sending, setSending] = useState(false);
  const [state, setState] = useState<"idle" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const t = (fr: string, en: string) => settings[language === "fr" ? fr : en] || settings[fr] || "";
  const required = (key: string, fallback: boolean) => enabled(settings[key], fallback);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setState("idle");
    setErrorText("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          email: data.get("email"),
          phone: data.get("phone"),
          message: data.get("message"),
          website: data.get("website"),
          locale: language,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || t("contact_error_fr", "contact_error_en"));
      form.reset();
      setState("success");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t("contact_error_fr", "contact_error_en"));
      setState("error");
    } finally {
      setSending(false);
    }
  }

  return <section className="contact-section-v228" id="contact">
    <div className="contact-copy-v228">
      <p className="eyebrow">{t("contact_eyebrow_fr", "contact_eyebrow_en")}</p>
      <h2>{t("contact_title_fr", "contact_title_en")}</h2>
      <p>{t("contact_intro_fr", "contact_intro_en")}</p>
      {t("contact_reply_note_fr", "contact_reply_note_en") && <span className="contact-reply-note-v228">{t("contact_reply_note_fr", "contact_reply_note_en")}</span>}
      <div className="contact-direct-v228">
        {settings.support_email && <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>}
        {settings.phone && <a href={`tel:${settings.phone.replace(/\s+/g, "")}`}>{settings.phone}</a>}
      </div>
    </div>

    <form className="contact-form-v228" onSubmit={submit}>
      <input className="contact-honeypot-v228" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" />
      <div className="contact-form-grid-v228">
        <label>{t("contact_first_name_label_fr", "contact_first_name_label_en")}{required("contact_first_name_required", true) && " *"}<input name="firstName" autoComplete="given-name" maxLength={100} required={required("contact_first_name_required", true)} /></label>
        <label>{t("contact_last_name_label_fr", "contact_last_name_label_en")}{required("contact_last_name_required", false) && " *"}<input name="lastName" autoComplete="family-name" maxLength={100} required={required("contact_last_name_required", false)} /></label>
        <label>{t("contact_email_label_fr", "contact_email_label_en")}{required("contact_email_required", true) && " *"}<input name="email" type="email" inputMode="email" autoComplete="email" maxLength={180} required={required("contact_email_required", true)} /></label>
        <label>{t("contact_phone_label_fr", "contact_phone_label_en")}{required("contact_phone_required", false) && " *"}<input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={60} required={required("contact_phone_required", false)} /></label>
        <label className="contact-message-field-v228">{t("contact_message_label_fr", "contact_message_label_en")}{required("contact_message_required", true) && " *"}<textarea name="message" rows={6} maxLength={4000} required={required("contact_message_required", true)} /></label>
      </div>
      <div className="contact-form-footer-v228">
        <div><small>{t("contact_required_note_fr", "contact_required_note_en")}</small><small>{t("contact_privacy_fr", "contact_privacy_en")} <Link href="/confidentialite">{language === "fr" ? "Confidentialité" : "Privacy"}</Link></small></div>
        <button className="button primary" disabled={sending}>{sending ? t("contact_sending_fr", "contact_sending_en") : t("contact_submit_fr", "contact_submit_en")}</button>
      </div>
      <div className="contact-form-status-v228" aria-live="polite">
        {state === "success" && <p className="success">✓ {t("contact_success_fr", "contact_success_en")}</p>}
        {state === "error" && <p className="error">{errorText || t("contact_error_fr", "contact_error_en")}</p>}
      </div>
    </form>
  </section>;
}
