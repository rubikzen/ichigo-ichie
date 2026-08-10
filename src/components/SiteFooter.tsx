"use client";

import Link from "next/link";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";

export function SiteFooter() {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const t = (fr: string, en: string) => settings[language === "fr" ? fr : en] || settings[fr] || "";
  const mapsHref = settings.store_maps_url || (settings.store_address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.store_address)}` : "");
  const instagramHref = settings.instagram
    ? (settings.instagram.startsWith("http") ? settings.instagram : `https://www.instagram.com/${settings.instagram.replace(/^@/, "")}`)
    : "";
  const phoneHref = settings.phone ? `tel:${settings.phone.replace(/\s+/g, "")}` : "";

  return <footer className="site-footer-v226 site-footer-v227">
    <div className="footer-main-v226 footer-main-v227">
      <div className="footer-brand-v226">
        <Link href="/#top" className="footer-brandline-v226">
          {settings.footer_show_logo !== "false" && settings.brand_logo_url && <img src={settings.brand_logo_url} alt="" />}
          <span><strong>{settings.footer_brand || settings.brand_name || "ICHIGO ICHIE"}</strong><small>{t("brand_subtitle_fr", "brand_subtitle_en")}</small></span>
        </Link>
        <p>{t("footer_tagline_fr", "footer_tagline_en")}</p>
      </div>

      <div className="footer-column-v226">
        <strong>{t("footer_nav_title_fr", "footer_nav_title_en")}</strong>
        <Link href="/#menu">{t("nav_menu_fr", "nav_menu_en")}</Link>
        <Link href="/#boutique">{t("nav_shop_fr", "nav_shop_en")}</Link>
        <Link href="/#maison">{t("nav_house_fr", "nav_house_en")}</Link>
        <Link href="/#contact">{t("nav_contact_fr", "nav_contact_en")}</Link>
      </div>

      <div className="footer-column-v226">
        <strong>{t("footer_visit_title_fr", "footer_visit_title_en")}</strong>
        {settings.store_address && (mapsHref ? <a href={mapsHref} target="_blank" rel="noreferrer">{settings.store_address}</a> : <span>{settings.store_address}</span>)}
        {settings.opening_hours && <span>{t("footer_open_prefix_fr", "footer_open_prefix_en")} · {settings.opening_hours}</span>}
        {settings.phone && <a href={phoneHref}>{settings.phone}</a>}
        {settings.support_email && <a href={`mailto:${settings.support_email}`}>{settings.support_email}</a>}
      </div>

      <div className="footer-column-v226">
        <strong>{t("footer_follow_title_fr", "footer_follow_title_en")}</strong>
        {instagramHref && <a href={instagramHref} target="_blank" rel="noreferrer">Instagram ↗</a>}
        {mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer">{t("footer_maps_label_fr", "footer_maps_label_en")} ↗</a>}
      </div>

      <div className="footer-column-v226 footer-legal-v227">
        <strong>{t("footer_legal_title_fr", "footer_legal_title_en")}</strong>
        <Link href="/mentions-legales">{t("legal_notice_label_fr", "legal_notice_label_en")}</Link>
        <Link href="/cgv">{t("terms_label_fr", "terms_label_en")}</Link>
        <Link href="/confidentialite">{t("privacy_label_fr", "privacy_label_en")}</Link>
        <Link href="/livraison-retours">{t("shipping_returns_label_fr", "shipping_returns_label_en")}</Link>
      </div>
    </div>

    <div className="footer-bottom-v226">
      <span>© {new Date().getFullYear()} {settings.footer_copyright_name || "Ichigo Ichie"}</span>
      <span>{t("footer_location_fr", "footer_location_en") || "Nice · France"}</span>
    </div>
  </footer>;
}
