"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useCart } from "./CartProvider";
import { useLanguage } from "./LanguageProvider";
import { useSiteSettings } from "./SiteSettingsProvider";

type SectionId = "menu" | "boutique" | "maison" | "";

const HIDDEN_PATH_PREFIXES = ["/checkout"];
const HOME_SECTION_IDS = ["menu", "boutique", "maison"] as const;

function sectionFromPathname(pathname: string): SectionId {
  if (pathname === "/menu" || pathname.startsWith("/menu/")) return "menu";
  if (pathname === "/boutique" || pathname.startsWith("/boutique/")) return "boutique";
  return "";
}

function readHashSection(): SectionId {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "");
  return HOME_SECTION_IDS.includes(hash as Exclude<SectionId, "">) ? hash as SectionId : "";
}

function subscribeHashSection(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function readServerHashSection(): SectionId {
  return "";
}

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
  const hashSection = useSyncExternalStore<SectionId>(subscribeHashSection, readHashSection, readServerHashSection);
  const t = (fr: string, en: string, fallback: string) => settings[language === "fr" ? fr : en] || settings[fr] || fallback;
  const hidden = HIDDEN_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const onHome = pathname === "/";
  const pathSection = sectionFromPathname(pathname);

  useEffect(() => {
    document.body.classList.toggle("mobile-dock-hidden-v236", hidden);
    return () => document.body.classList.remove("mobile-dock-hidden-v236");
  }, [hidden]);

  useEffect(() => {
    if (!onHome) return;
    const nodes = HOME_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;

    const updateActiveFromViewport = () => {
      const marker = Math.min(window.innerHeight * 0.42, 420);
      const ranked = nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const containsMarker = rect.top <= marker && rect.bottom >= marker;
          const distance = containsMarker
            ? 0
            : Math.min(Math.abs(rect.top - marker), Math.abs(rect.bottom - marker));
          return { id: node.id as SectionId, distance, top: rect.top };
        })
        .sort((a, b) => a.distance - b.distance || Math.abs(a.top) - Math.abs(b.top));

      if (ranked[0]?.id) setActive(ranked[0].id);
    };

    const observer = new IntersectionObserver(updateActiveFromViewport, {
      rootMargin: "-18% 0px -62% 0px",
      threshold: [0, .01, .08, .2],
    });
    const frame = window.requestAnimationFrame(updateActiveFromViewport);

    nodes.forEach((node) => observer.observe(node));
    window.addEventListener("hashchange", updateActiveFromViewport);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", updateActiveFromViewport);
      observer.disconnect();
    };
  }, [onHome]);

  const visibleActive: SectionId = pathSection || (onHome ? active || hashSection : "");

  if (hidden) return null;

  return (
    <nav className="mobile-bottom-nav-v225 mobile-bottom-nav-v236" aria-label={language === "fr" ? "Navigation mobile" : "Mobile navigation"}>
      <Link href="/#menu" className={visibleActive === "menu" ? "active" : ""} aria-current={visibleActive === "menu" ? "location" : undefined}>
        <IconMenu />
        <span>{language === "fr" ? "Carte" : "Menu"}</span>
      </Link>
      <Link href="/#boutique" className={visibleActive === "boutique" ? "active" : ""} aria-current={visibleActive === "boutique" ? "location" : undefined}>
        <IconShop />
        <span>{t("nav_shop_fr", "nav_shop_en", language === "fr" ? "Boutique" : "Shop")}</span>
      </Link>
      <Link href="/#maison" className={visibleActive === "maison" ? "active" : ""} aria-current={visibleActive === "maison" ? "location" : undefined}>
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
