"use client";

import Link from "next/link";
import Image from "next/image";
import type { Category, Product } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { HomeFeatured } from "./HomeFeatured";
import { UnifiedCatalogSections } from "./UnifiedCatalogSections";
import { settingEnabled } from "@/lib/settings";
import { ContactSection } from "./ContactSection";
import { SafeImage } from "./SafeImage";

export function HomePageContent({
  shopFeatured,
  menuCategories,
  menuProducts,
  shopCategories,
  shopProducts,
}: {
  shopFeatured: Product[];
  menuCategories: Category[];
  menuProducts: Product[];
  shopCategories: Category[];
  shopProducts: Product[];
}) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const t = (fr: string, en: string) =>
    settings[language === "fr" ? fr : en] || settings[fr] || "";

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
                  />
                )}
                <span>
                  {settings.story_card_label ||
                    settings.brand_name ||
                    "ICHIGO ICHIE"}
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

      <style jsx global>{`
        .mobile-home-flow-v260,
        .mobile-hero-assurance-v260,
        .mobile-menu-cta-v260 {
          display: none;
        }

        @media (max-width: 760px) {
          .premium-home-mobile-v260 {
            overflow: hidden;
          }

          .premium-home-mobile-v260 > .home-featured {
            display: none;
          }

          .hero-mobile-v260 {
            min-height: auto;
            grid-template-columns: 1fr;
            gap: 22px;
            padding: 26px 18px 34px;
          }

          .hero-mobile-v260 .hero-copy {
            max-width: none;
            order: 2;
          }

          .hero-mobile-v260 .hero-visual {
            order: 1;
            min-height: 0;
            display: block;
          }

          .hero-mobile-v260 .hero-visual img {
            width: 100%;
            height: min(53vh, 470px);
            min-height: 330px;
            object-fit: cover;
            border-radius: 24px;
            transform: none;
            box-shadow: 0 18px 50px rgba(31, 47, 34, 0.12);
          }

          .hero-mobile-v260 .floating-note {
            left: 14px;
            top: auto;
            bottom: 14px;
            transform: none;
            max-width: calc(100% - 28px);
            padding: 8px 12px;
            font-size: 13px;
          }

          .hero-mobile-v260 .eyebrow {
            margin-bottom: 9px;
          }

          .hero-mobile-v260 h1 {
            font-size: clamp(42px, 13vw, 58px);
            line-height: 0.98;
            letter-spacing: -0.045em;
          }

          .hero-mobile-v260 .hero-text {
            font-size: 15px;
            line-height: 1.65;
            margin: 17px 0 20px;
          }

          .hero-mobile-v260 .hero-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .hero-mobile-v260 .hero-actions .button {
            min-height: 48px;
            padding-inline: 12px;
          }

          .mobile-menu-cta-v260,
          .mobile-hero-assurance-v260 {
            display: flex;
          }

          .mobile-hero-assurance-v260 {
            align-items: center;
            gap: 8px;
            margin-top: 15px;
            color: var(--muted);
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .mobile-hero-assurance-v260 i {
            color: var(--sage);
            font-style: normal;
          }

          .mobile-home-flow-v260 {
            display: block;
          }

          .mobile-matcha-intro-v260,
          .mobile-shop-featured-v260,
          .mobile-trust-v260,
          .mobile-shop-cta-v260 {
            padding: 54px 18px;
          }

          .mobile-matcha-intro-v260 {
            background: var(--soft);
          }

          .mobile-matcha-intro-v260 h2,
          .mobile-section-heading-v260 h2,
          .mobile-shop-cta-v260 h2 {
            margin: 0;
            font: 400 36px/1.04 var(--serif);
            letter-spacing: -0.035em;
          }

          .mobile-section-lead-v260,
          .mobile-section-heading-v260 > div > p:last-child,
          .mobile-shop-cta-v260 > p:not(.eyebrow) {
            color: var(--muted);
            font-size: 14px;
            line-height: 1.7;
          }

          .mobile-section-lead-v260 {
            margin: 17px 0 30px;
          }

          .mobile-matcha-values-v260 {
            display: grid;
            gap: 0;
            border-top: 1px solid var(--line);
          }

          .mobile-matcha-values-v260 article {
            display: grid;
            grid-template-columns: 38px 1fr;
            gap: 12px;
            padding: 18px 0;
            border-bottom: 1px solid var(--line);
          }

          .mobile-matcha-values-v260 article > span {
            color: var(--moss);
            font: 400 17px var(--serif);
          }

          .mobile-matcha-values-v260 strong {
            display: block;
            font: 400 20px/1.15 var(--serif);
          }

          .mobile-matcha-values-v260 p {
            margin: 5px 0 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.55;
          }

          .mobile-shop-featured-v260 {
            background: var(--paper);
          }

          .mobile-section-heading-v260 {
            display: grid;
            grid-template-columns: 1fr 42px;
            gap: 12px;
            align-items: end;
            margin-bottom: 24px;
          }

          .mobile-section-heading-v260 > a {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            border: 1px solid var(--line);
            border-radius: 50%;
            background: #fff;
            font-size: 20px;
          }

          .mobile-section-heading-v260 > div > p:last-child {
            margin: 12px 0 0;
          }

          .mobile-featured-scroll-v260 {
            display: grid;
            grid-auto-flow: column;
            grid-auto-columns: min(82vw, 330px);
            gap: 12px;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            overscroll-behavior-inline: contain;
            padding: 2px 18px 12px 0;
            scrollbar-width: none;
          }

          .mobile-featured-scroll-v260::-webkit-scrollbar {
            display: none;
          }

          .mobile-featured-item-v260 {
            scroll-snap-align: start;
            min-width: 0;
          }

          .mobile-featured-item-v260 .product-card {
            height: 100%;
            border-radius: 22px;
          }

          .mobile-featured-item-v260 .product-image {
            aspect-ratio: 1 / 0.82;
          }

          .mobile-featured-item-v260 .product-copy {
            padding: 16px;
          }

          .mobile-featured-item-v260 .product-title-row h3 {
            font-size: 21px;
          }

          .mobile-trust-v260 {
            background: #fff;
            border-block: 1px solid var(--line);
          }

          .mobile-trust-grid-v260 {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .mobile-trust-grid-v260 article {
            display: grid;
            grid-template-columns: 38px 1fr;
            column-gap: 12px;
            align-items: start;
            padding: 17px;
            border: 1px solid var(--line);
            border-radius: 18px;
            background: var(--paper);
          }

          .mobile-trust-grid-v260 article > span {
            grid-row: 1 / 3;
            display: grid;
            place-items: center;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: #edf1e8;
            color: var(--moss-dark);
            font-weight: 800;
          }

          .mobile-trust-grid-v260 strong {
            font-size: 14px;
          }

          .mobile-trust-grid-v260 p {
            margin: 3px 0 0;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.5;
          }

          .mobile-shop-cta-v260 {
            background: var(--moss-dark);
            color: #fff;
          }

          .mobile-shop-cta-v260 .eyebrow {
            color: var(--sage);
          }

          .mobile-shop-cta-v260 > p:not(.eyebrow) {
            color: rgba(255, 255, 255, 0.72);
            margin: 15px 0 24px;
          }

          .mobile-shop-cta-v260 .button.primary {
            background: #fff;
            border-color: #fff;
            color: var(--moss-dark);
            min-height: 52px;
          }

          .premium-home-mobile-v260 .onepage-catalog {
            scroll-margin-top: 92px;
          }
        }
      `}</style>
    </main>
  );
}
