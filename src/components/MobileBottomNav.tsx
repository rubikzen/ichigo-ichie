"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";

type SectionId = "menu" | "boutique" | "maison" | "";

const HIDDEN_PATH_PREFIXES = ["/checkout"];

function IconMenu() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16M4 12h16M4 17.5h10" /></svg>;
}
function IconShop() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h14l-1 11H6L5 9Z"/><path d="M8 9a4 4 0 0 1 8 0" /></svg>;
}
function IconHouse() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7"/><path d="M6.5 10v10h11V10M10 20v-6h4v6" /></svg>;
}
function IconAccount() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/></svg>;
}
function IconCart() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h2l2 10h10l2-7H6"/><circle cx="9" cy="19" r="1.2"/><circle cx="17" cy="19" r="1.2" /></svg>;
}

function MobileCartLinkStatus({
  count,
  label,
  language,
}: {
  count: number;
  label: string;
  language: "fr" | "en";
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      <span className={`mobile-nav-icon-wrap-v225 mobile-cart-icon-v381${pending ? " is-loading" : ""}`}>
        {pending
          ? <i className="mobile-cart-spinner-v381" aria-hidden="true" />
          : <IconCart />}
        {!pending && count > 0 && <b>{count > 99 ? "99+" : count}</b>}
      </span>
      <span role="status" aria-live="polite">
        {pending
          ? language === "fr"
            ? "Ouverture…"
            : "Opening…"
          : label}
      </span>
    </>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const [active, setActive] = useState<SectionId>("");
  const t = (fr: string, en: string, fallback: string) => settings[language === "fr" ? fr : en] || settings[fr] || fallback;
  const hidden = HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const onHome = pathname === "/";

  useEffect(() => {
    document.body.classList.toggle("mobile-dock-hidden-v236", hidden);
    return () => document.body.classList.remove("mobile-dock-hidden-v236");
  }, [hidden]);

  useEffect(() => {
    if (!onHome) return;
    const nodes = (["menu", "boutique", "maison"] as const)
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActive(visible.target.id as SectionId);
    }, { rootMargin: "-28% 0px -56% 0px", threshold: [0, .08, .2, .5] });

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [onHome]);

  const visibleActive: SectionId = onHome ? active : "";

  if (hidden) return null;

  return (
    <nav className="mobile-bottom-nav-v225 mobile-bottom-nav-v236" aria-label={language === "fr" ? "Navigation mobile" : "Mobile navigation"}>
      <Link href="/#menu" className={visibleActive === "menu" ? "active" : ""}>
        <IconMenu />
        <span>{language === "fr" ? "Carte" : "Menu"}</span>
      </Link>
      <Link href="/#boutique" className={visibleActive === "boutique" ? "active" : ""}>
        <IconShop />
        <span>{t("nav_shop_fr", "nav_shop_en", language === "fr" ? "Boutique" : "Shop")}</span>
      </Link>
      <Link href="/#maison" className={visibleActive === "maison" ? "active" : ""}>
        <IconHouse />
        <span>{language === "fr" ? "Maison" : "About"}</span>
      </Link>
      <Link href="/compte" className={pathname.startsWith("/compte") ? "active" : ""}>
        <IconAccount />
        <span>{language === "fr" ? "Compte" : "Account"}</span>
      </Link>
      <Link
        href="/panier"
        className={`mobile-cart-item-v225 mobile-cart-link-v381${pathname.startsWith("/panier") ? " active" : ""}`}
        aria-label={language === "fr" ? "Ouvrir le panier" : "Open cart"}
      >
        <MobileCartLinkStatus
          count={count}
          label={t("nav_cart_fr", "nav_cart_en", language === "fr" ? "Panier" : "Cart")}
          language={language}
        />
      </Link>
    </nav>
  );
}
