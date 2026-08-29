"use client";

import Link from "next/link";
import Image from "next/image";
import type { Category, Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { HomeFeatured } from "./HomeFeatured";
import { UnifiedCatalogSections } from "./UnifiedCatalogSections";
import { ReviewSummaryProvider } from "./ReviewSummaryProvider";
import { settingEnabled } from "@/lib/settings";
import { ContactSection } from "./ContactSection";
import { SafeImage } from "./SafeImage";
import { MatchaGuidesTeaser } from "./MatchaGuidesTeaser";

export function HomePageContent({
  shopFeaturedIds,
  menuCategories,
  menuProducts,
  shopCategories,
  shopProducts,
}: {
  shopFeaturedIds: string[];
  menuCategories: Category[];
  menuProducts: Product[];
  shopCategories: Category[];
  shopProducts: Product[];
}) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const t = (fr: string, en: string) =>
    settings[language === "fr" ? fr : en] || settings[fr] || "";
  const shopProductsById = new Map(shopProducts.map((product) => [product.id, product]));
  const shopFeatured = shopFeaturedIds
    .map((id) => shopProductsById.get(id))
    .filter((product): product is Product => Boolean(product));

  const mobile = language === "fr"
    ? {
        introEyebrow: "MATCHA JAPONAIS",
        introTitle: "Le matcha, dans sa forme la plus simple.",
        introText:
          "Une sélection japonaise choisie pour sa finesse, son équilibre et le plaisir d’une préparation quotidienne.",
        origin: "Sélection japonaise",
        originText: "Des matchas choisis pour leur profil et leur usage.",
        ritual: "Usucha ou latte",
        ritualText: "À préparer selon votre moment, sans complication.",
        nice: "Maison à Nice",
        niceText: "Retrait boutique ou livraison en France métropolitaine.",
        trustTitle: "Commander simplement",
        secure: "Paiement sécurisé",
        secureText: "Paiement en ligne via Stripe.",
        delivery: "Livraison en France",
        deliveryText: "Suivi colis disponible après expédition.",
        pickup: "Retrait à Nice",
        pickupText: "Commandez en ligne et récupérez à la boutique.",
        cta: "Découvrir la Boutique",
        menuCta: "Voir la carte",
      }
    : {
        introEyebrow: "JAPANESE MATCHA",
        introTitle: "Matcha, in its simplest form.",
        introText:
          "A Japanese selection chosen for finesse, balance and the pleasure of an everyday ritual.",
        origin: "Japanese selection",
        originText: "Matchas selected for their profile and intended use.",
        ritual: "Usucha or latte",
        ritualText: "Prepare it for your moment, without complication.",
        nice: "A house in Nice",
        niceText: "Store pickup or delivery across metropolitan France.",
        trustTitle: "Order with confidence",
        secure: "Secure payment",
        secureText: "Online payment powered by Stripe.",
        delivery: "Delivery in France",
        deliveryText: "Parcel tracking available after shipment.",
        pickup: "Pickup in Nice",
        pickupText: "Order online and collect from the shop.",
        cta: "Explore the Shop",
        menuCta: "View the menu",
      };

  return (
    <ReviewSummaryProvider productIds={shopProducts.map((product) => product.id)}>
      <main id="top" className="onepage-main premium-home-v224 premium-home-mobile-v260">
        {settingEnabled(settings.home_hero_visible) && (
          <section className="hero hero-v218 hero-v224 hero-mobile-v260">
            <div className="hero-copy hero-copy-v224">
              <p className="eyebrow">{t("home_eyebrow_fr", "home_eyebrow_en")}</p>
              <h1 className="cms-multiline">{t("home_title_fr", "home_title_en")}</h1>
              <p className="hero-text">{t("home_intro_fr", "home_intro_en")}</p>

              <div className="hero-actions hero-actions-v224">
                <Link className="button primary" href="/#boutique">
                  {t("home_secondary_cta_fr", "home_secondary_cta_en") || mobile.cta}
                </Link>
                <Link className="button ghost mobile-menu-cta-v260" href="/#menu">
                  {mobile.menuCta}
                </Link>
              </div>

              <div className="mobile-hero-assurance-v260" aria-label={mobile.trustTitle}>
                <span>Japan</span>
                <i aria-hidden="true">•</i>
                <span>Nice</span>
                <i aria-hidden="true">•</i>
                <span>France</span>
              </div>
            </div>

            <div className="hero-visual hero-visual-v224" aria-hidden="true">
              <Image
                src={settings.home_hero_image_url || "/products/matcha-coconut-cloud.webp"}
                alt=""
                width={1200}
                height={1000}
                priority
                sizes="(max-width: 760px) calc(100vw - 36px), (max-width: 1200px) 45vw, 520px"
              />
              {t("home_hero_note1_fr", "home_hero_note1_en") && (
                <span className="floating-note note-one note-one-v224">
                  {t("home_hero_note1_fr", "home_hero_note1_en")}
                </span>
              )}
            </div>
          </section>
        )}

        {settingEnabled(settings.home_featured_visible) && (
          <HomeFeatured products={shopFeatured} />
        )}

        <UnifiedCatalogSections
          menuCategories={menuCategories}
          menuProducts={menuProducts}
          shopCategories={shopCategories}
          shopProducts={shopProducts}
        />

        <MatchaGuidesTeaser />

        <section
          className="mobile-home-flow-v260 mobile-home-after-catalog-v4491"
          aria-label={mobile.introTitle}
        >
          <div className="mobile-matcha-intro-v260">
            <p className="eyebrow">{mobile.introEyebrow}</p>
            <h2>{mobile.introTitle}</h2>
            <p className="mobile-section-lead-v260">{mobile.introText}</p>

            <div className="mobile-matcha-values-v260">
              <article>
                <span aria-hidden="true">01</span>
                <div>
                  <strong>{mobile.origin}</strong>
                  <p>{mobile.originText}</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true">02</span>
                <div>
                  <strong>{mobile.ritual}</strong>
                  <p>{mobile.ritualText}</p>
                </div>
              </article>
              <article>
                <span aria-hidden="true">03</span>
                <div>
                  <strong>{mobile.nice}</strong>
                  <p>{mobile.niceText}</p>
                </div>
              </article>
            </div>
          </div>

          <section className="mobile-trust-v260">
            <p className="eyebrow">{mobile.trustTitle}</p>
            <div className="mobile-trust-grid-v260">
              <article>
                <span aria-hidden="true">✓</span>
                <strong>{mobile.secure}</strong>
                <p>{mobile.secureText}</p>
              </article>
              <article>
                <span aria-hidden="true">→</span>
                <strong>{mobile.delivery}</strong>
                <p>{mobile.deliveryText}</p>
              </article>
              <article>
                <span aria-hidden="true">⌂</span>
                <strong>{mobile.pickup}</strong>
                <p>{mobile.pickupText}</p>
              </article>
            </div>
          </section>
        </section>

        {settingEnabled(settings.home_story_visible) && (
          <section className="house-section-v226" id="maison">
            <div
              className={`house-media-v226 ${
                settings.story_image_url ? "has-media" : "is-fallback"
              }`}
            >
              {settings.story_image_url ? (
                <SafeImage
                  src={settings.story_image_url}
                  alt={t("story_title_fr", "story_title_en")}
                  fill
                  sizes="(max-width: 980px) calc(100vw - 36px), 50vw"
                  loading="lazy"
                />
              ) : (
                <div className="house-media-fallback-v226">
                  {settings.brand_logo_url && (
                    <SafeImage
                      src={settings.brand_logo_url}
                      alt=""
                      width={86}
                      height={86}
                      sizes="86px"
                      loading="lazy"
                    />
                  )}
                  <span>
                    {settings.story_card_label || settings.brand_name || "ICHIGO ICHIE"}
                  </span>
                </div>
              )}
              <span className="house-place-v226">Nice</span>
            </div>

            <div className="house-content-v226">
              <p className="eyebrow">
                {t("story_eyebrow_fr", "story_eyebrow_en")}
              </p>
              <h2>{t("story_title_fr", "story_title_en")}</h2>
              <p className="house-story-text-v226">
                {t("story_text_fr", "story_text_en")}
              </p>

              <div className="house-facts-v226">
                {settings.store_address && (
                  <div className="house-fact-v226">
                    <small>
                      {t("story_address_label_fr", "story_address_label_en")}
                    </small>
                    <strong>{settings.store_address}</strong>
                  </div>
                )}
                {settings.opening_hours && (
                  <div className="house-fact-v226">
                    <small>
                      {t("story_hours_label_fr", "story_hours_label_en")}
                    </small>
                    <strong>{settings.opening_hours}</strong>
                  </div>
                )}
                {settings.phone && (
                  <div className="house-fact-v226">
                    <small>
                      {t("story_phone_label_fr", "story_phone_label_en")}
                    </small>
                    <a href={`tel:${settings.phone.replace(/\s+/g, "")}`}>
                      {settings.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="house-actions-v226">
                {(settings.store_maps_url || settings.store_address) && (
                  <a
                    className="button primary"
                    href={
                      settings.store_maps_url ||
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        settings.store_address,
                      )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("story_maps_cta_fr", "story_maps_cta_en")}
                  </a>
                )}
                {settings.instagram && (
                  <a
                    className="button ghost"
                    href={
                      settings.instagram.startsWith("http")
                        ? settings.instagram
                        : `https://www.instagram.com/${settings.instagram.replace(
                            /^@/,
                            "",
                          )}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("story_instagram_cta_fr", "story_instagram_cta_en")}
                  </a>
                )}
                <Link className="house-text-link-v226" href="/matcha-nice">
                  {language === "fr" ? "Matcha à Nice →" : "Matcha in Nice →"}
                </Link>
                {t("story_link_fr", "story_link_en") && (
                  <Link className="house-text-link-v226" href="/#menu">
                    {t("story_link_fr", "story_link_en")}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {settingEnabled(settings.contact_visible) && <ContactSection />}
      </main>
    </ReviewSummaryProvider>
  );
}
