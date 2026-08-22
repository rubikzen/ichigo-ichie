"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";

const DISCOVERY_PREFIXES = ["/boutique", "/guides", "/matcha-"] as const;

function shouldShow(pathname: string) {
  if (pathname === "/") return true;
  return DISCOVERY_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix === "/matcha-" ? prefix : `${prefix}/`),
  );
}

export function MatchaExploreNav() {
  const pathname = usePathname();
  const { language } = useLanguage();
  const fr = language === "fr";
  const activeLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const active = activeLinkRef.current;
    const scroller = active?.parentElement;

    if (
      !active ||
      !scroller ||
      !window.matchMedia("(max-width: 820px)").matches
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const targetLeft =
        active.offsetLeft -
        Math.max(0, (scroller.clientWidth - active.clientWidth) / 2);

      scroller.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [language, pathname]);

  if (!shouldShow(pathname)) return null;

  const links = [
    {
      href: "/boutique",
      label: fr ? "Boutique" : "Shop",
      active: pathname === "/boutique" || pathname.startsWith("/boutique/"),
    },
    {
      href: "/matcha-nice",
      label: fr ? "Nice" : "Nice",
      active: pathname === "/matcha-nice",
    },
    {
      href: "/guides",
      label: fr ? "Guides" : "Guides",
      active: pathname === "/guides" || pathname.startsWith("/guides/"),
    },
    ...MATCHA_INTENT_SUMMARIES.map((item) => ({
      href: item.href,
      label: fr ? item.labelFr : item.labelEn,
      active: pathname === item.href,
    })),
  ];

  return (
    <nav
      className="matcha-explore-nav-v472"
      aria-label={fr ? "Explorer le matcha" : "Explore matcha"}
      data-matcha-explore-nav-v472
    >
      <div>
        <span className="matcha-explore-label-v472">
          {fr ? "Explorer" : "Explore"}
        </span>
        <div className="matcha-explore-scroll-v472">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              ref={item.active ? activeLinkRef : undefined}
              className={item.active ? "active" : ""}
              aria-current={item.active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
