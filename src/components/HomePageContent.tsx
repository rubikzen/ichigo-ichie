"use client";

import Link from "next/link";
import type { Category, Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { HomeFeatured } from "./HomeFeatured";
import { UnifiedCatalogSections } from "./UnifiedCatalogSections";
import { settingEnabled } from "@/lib/settings";
import { ContactSection } from "./ContactSection";

export function HomePageContent({
  featured,
  menuCategories,
  menuProducts,
  shopCategories,
  shopProducts,
}: {
  featured: Product[];
  menuCategories: Category[];
  menuProducts: Product[];
  shopCategories: Category[];
  shopProducts: Product[];
}) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const t = (fr: string, en: string) => settings[language === "fr" ? fr : en] || settings[fr] || "";

  return <main id="top" className="onepage-main premium-home-v224">
    {settingEnabled(settings.home_hero_visible) && <section className="hero hero-v218 hero-v224">
      <div className="hero-copy hero-copy-v224">
        <p className="eyebrow">{t("home_eyebrow_fr", "home_eyebrow_en")}</p>
        <h1 className="cms-multiline">{t("home_title_fr", "home_title_en")}</h1>
        <p className="hero-text">{t("home_intro_fr", "home_intro_en")}</p>
        <div className="hero-actions hero-actions-v224">
          <Link className="button primary" href="/#menu">{t("home_primary_cta_fr", "home_primary_cta_en")}</Link>
          <Link className="button ghost" href="/#boutique">{t("home_secondary_cta_fr", "home_secondary_cta_en")}</Link>
        </div>
      </div>

      <div className="hero-visual hero-visual-v224" aria-hidden="true">
        <img src={settings.home_hero_image_url || "/products/matcha-coconut-cloud.webp"} alt="" loading="eager" decoding="async" fetchPriority="high" />
        {t("home_hero_note1_fr", "home_hero_note1_en") && (
          <span className="floating-note note-one note-one-v224">{t("home_hero_note1_fr", "home_hero_note1_en")}</span>
        )}
      </div>
    </section>}

    {settingEnabled(settings.home_featured_visible) && <HomeFeatured products={featured} />}

    <UnifiedCatalogSections
      menuCategories={menuCategories}
      menuProducts={menuProducts}
      shopCategories={shopCategories}
      shopProducts={shopProducts}
    />

    {settingEnabled(settings.home_story_visible) && <section className="house-section-v226" id="maison">
      <div className={`house-media-v226 ${settings.story_image_url ? "has-media" : "is-fallback"}`}>
        {settings.story_image_url ? (
          <img src={settings.story_image_url} alt={t("story_title_fr", "story_title_en")} loading="lazy" decoding="async" />
        ) : (
          <div className="house-media-fallback-v226">
            {settings.brand_logo_url && <img src={settings.brand_logo_url} alt="" loading="lazy" decoding="async" />}
            <span>{settings.story_card_label || settings.brand_name || "ICHIGO ICHIE"}</span>
          </div>
        )}
        <span className="house-place-v226">Nice</span>
      </div>

      <div className="house-content-v226">
        <p className="eyebrow">{t("story_eyebrow_fr", "story_eyebrow_en")}</p>
        <h2>{t("story_title_fr", "story_title_en")}</h2>
        <p className="house-story-text-v226">{t("story_text_fr", "story_text_en")}</p>

        <div className="house-facts-v226">
          {settings.store_address && <div className="house-fact-v226">
            <small>{t("story_address_label_fr", "story_address_label_en")}</small>
            <strong>{settings.store_address}</strong>
          </div>}
          {settings.opening_hours && <div className="house-fact-v226">
            <small>{t("story_hours_label_fr", "story_hours_label_en")}</small>
            <strong>{settings.opening_hours}</strong>
          </div>}
          {settings.phone && <div className="house-fact-v226">
            <small>{t("story_phone_label_fr", "story_phone_label_en")}</small>
            <a href={`tel:${settings.phone.replace(/\s+/g, "")}`}>{settings.phone}</a>
          </div>}
        </div>

        <div className="house-actions-v226">
          {(settings.store_maps_url || settings.store_address) && <a className="button primary" href={settings.store_maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.store_address)}`} target="_blank" rel="noreferrer">
            {t("story_maps_cta_fr", "story_maps_cta_en")}
          </a>}
          {settings.instagram && <a className="button ghost" href={settings.instagram.startsWith("http") ? settings.instagram : `https://www.instagram.com/${settings.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer">
            {t("story_instagram_cta_fr", "story_instagram_cta_en")}
          </a>}
          {t("story_link_fr", "story_link_en") && <Link className="house-text-link-v226" href="/#menu">{t("story_link_fr", "story_link_en")}</Link>}
        </div>
      </div>
    </section>}

    {settingEnabled(settings.contact_visible) && <ContactSection />}
  </main>;
}
