"use client";

import Link, { useLinkStatus } from "next/link";
import { SafeImage } from "./SafeImage";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";
import { MobileBottomNav } from "./MobileBottomNav";
import { settingEnabled } from "@/lib/settings";

function CartLinkStatus({
  label,
  count,
  language,
}: {
  label: string;
  count: number;
  language: "fr" | "en";
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending
        ? language === "fr"
          ? "Ouverture…"
          : "Opening…"
        : label}
      <span
        className={pending ? "cart-count-v378 is-loading" : "cart-count-v378"}
        role="status"
        aria-live="polite"
        aria-label={
          pending
            ? language === "fr"
              ? "Ouverture du panier"
              : "Opening cart"
            : `${count}`
        }
      >
        {pending ? <i className="cart-spinner-v378" aria-hidden="true" /> : count}
      </span>
    </>
  );
}

export function SiteHeader() {
  const { count } = useCart();
  const { language, setLanguage } = useLanguage();
  const { settings } = useSiteSettings();
  const [scrolled, setScrolled] = useState(false);
  const t = (fr: string, en: string) =>
    settings[language === "fr" ? fr : en] || settings[fr] || "";

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 28);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
      {settingEnabled(settings.announcement_visible) && (
        <div className="announcement">
          {t("announcement_fr", "announcement_en")}
        </div>
      )}

      <header
        className={`site-header site-header-v219 site-header-v224 site-header-v225 site-header-v261${
          scrolled ? " is-scrolled" : ""
        }`}
      >
        <Link
          className="brand brand-v224"
          href="/#top"
          aria-label={settings.brand_name || "Ichigo Ichie"}
        >
          <SafeImage
            src={settings.brand_logo_url || "/brand-mark.svg"}
            alt=""
            width={42}
            height={42}
            sizes="42px"
            priority
          />
          <span>
            <strong>{settings.brand_name || "ICHIGO ICHIE"}</strong>
            <small>{t("brand_subtitle_fr", "brand_subtitle_en")}</small>
          </span>
        </Link>

        <nav
          className="desktop-nav desktop-nav-v219 desktop-nav-v224"
          aria-label="Navigation principale"
        >
          <Link href="/#boutique">{t("nav_shop_fr", "nav_shop_en")}</Link>
          <Link href="/#menu">{t("nav_menu_fr", "nav_menu_en")}</Link>
          <Link href="/#maison">{t("nav_house_fr", "nav_house_en")}</Link>
          <Link href="/#contact">{t("nav_contact_fr", "nav_contact_en")}</Link>
        </nav>

        <div className="header-actions header-actions-v224">
          <div
            className="language-switch language-switch-mobile-visible-v261"
            aria-label={language === "fr" ? "Changer de langue" : "Change language"}
          >
            <button
              type="button"
              className={language === "fr" ? "active" : ""}
              aria-pressed={language === "fr"}
              onClick={() => setLanguage("fr")}
            >
              FR
            </button>
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              aria-pressed={language === "en"}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
          </div>

          <Link
            className="account-link-v243"
            href="/compte"
            aria-label={language === "fr" ? "Mon compte" : "My account"}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" />
            </svg>
            <span>{language === "fr" ? "Mon compte" : "Account"}</span>
          </Link>

          <Link
            className="cart-link cart-link-v225 cart-link-v378"
            href="/panier"
            aria-label={language === "fr" ? "Ouvrir le panier" : "Open cart"}
          >
            <CartLinkStatus
              label={t("nav_cart_fr", "nav_cart_en")}
              count={count}
              language={language}
            />
          </Link>
        </div>
      </header>

      <MobileBottomNav />

      <style jsx global>{`
        .cart-link-v378 {
          transition:
            transform 120ms ease,
            background-color 120ms ease,
            border-color 120ms ease,
            opacity 120ms ease;
        }

        .cart-link-v378:active {
          transform: scale(0.96);
        }

        .cart-link-v378:has(.cart-count-v378.is-loading) {
          cursor: progress;
          background: rgba(35, 67, 52, 0.08);
          border-color: rgba(35, 67, 52, 0.22);
        }

        .cart-link-v378 .cart-count-v378.is-loading {
          display: inline-grid;
          place-items: center;
        }

        .cart-spinner-v378 {
          width: 11px;
          height: 11px;
          border: 2px solid currentColor;
          border-right-color: transparent;
          border-radius: 999px;
          animation: cart-spin-v378 650ms linear infinite;
        }

        @keyframes cart-spin-v378 {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .cart-link-v378 {
            transition: none;
          }

          .cart-spinner-v378 {
            animation-duration: 1.4s;
          }
        }

        @media (max-width: 560px) {
          /*
           * globals.css masquait historiquement .language-switch sur les
           * téléphones étroits. On le réactive explicitement dans le header.
           */
          .site-header-v261 .language-switch-mobile-visible-v261 {
            display: flex !important;
            flex: 0 0 auto;
            transform: none !important;
            padding: 2px;
          }

          .site-header-v261 .language-switch-mobile-visible-v261 button {
            min-width: 32px;
            min-height: 32px;
            padding: 4px 7px;
            font-size: 10px;
          }

          .site-header-v261 {
            padding-inline: 12px !important;
            gap: 8px !important;
          }

          .site-header-v261 .brand {
            min-width: 0;
            gap: 8px;
          }

          .site-header-v261 .brand > span {
            min-width: 0;
          }

          .site-header-v261 .brand strong {
            display: block;
            max-width: none;
            overflow: visible;
            text-overflow: clip;
            white-space: nowrap;
            font-size: 13px;
          }

          .site-header-v261 .header-actions {
            flex: 0 0 auto;
            gap: 6px !important;
          }

          .site-header-v261 .account-link-v243 {
            width: 36px;
            min-width: 36px;
            min-height: 36px;
            height: 36px;
          }
        }

        @media (max-width: 370px) {
          .site-header-v261 .brand strong {
            max-width: none;
            font-size: 11.5px;
          }

          .site-header-v261 .language-switch-mobile-visible-v261 button {
            min-width: 29px;
            padding-inline: 5px;
          }
        }
      `}</style>
    </>
  );
}
