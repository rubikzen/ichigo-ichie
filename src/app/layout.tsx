import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteChrome } from "@/components/SiteChrome";
import { getSiteSettings } from "@/lib/settings";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.ichigoichiematcha.fr").replace(/\/$/, "");
}

function absoluteUrl(value: string | undefined, fallback: string) {
  const raw = (value || fallback).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return new URL(raw.startsWith("/") ? raw : `/${raw}`, `${siteUrl()}/`).toString();
}

function instagramUrl(value: string | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.instagram.com/${raw.replace(/^@/, "").replace(/\/$/, "")}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const brand = settings.brand_name || "ICHIGO ICHIE";
  const title = settings.seo_title || "Ichigo Ichie — Maison de Matcha à Nice";
  const description =
    settings.seo_description ||
    "Maison japonaise de matcha à Nice : carte sur place, matcha japonais et accessoires disponibles dans notre boutique en ligne.";
  const previewImage = absoluteUrl(settings.home_hero_image_url, "/brand-mark.svg");

  return {
    metadataBase: new URL(siteUrl()),
    applicationName: brand,
    title: {
      default: title,
      template: `%s · ${brand}`,
    },
    description,
    creator: brand,
    publisher: brand,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    icons: {
      icon: "/brand-mark.svg",
      shortcut: "/brand-mark.svg",
      apple: "/brand-mark.svg",
    },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: brand,
      title,
      description,
      images: [
        {
          url: previewImage,
          alt: `${brand} — Maison de matcha à Nice`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [previewImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  const themeStyle = {
    "--ink": settings.theme_ink || "#26362d",
    "--moss": settings.theme_moss || "#486a4b",
    "--moss-dark": settings.theme_moss_dark || "#294237",
    "--paper": settings.theme_paper || "#fffdf8",
    "--soft": settings.theme_soft || "#f5f2e8",
    "--radius": `${Number(settings.theme_radius || 26)}px`,
  } as CSSProperties;

  const brand = settings.brand_name || "ICHIGO ICHIE";
  const description =
    settings.seo_description ||
    "Maison japonaise de matcha à Nice : carte sur place, matcha japonais et accessoires disponibles dans notre boutique en ligne.";
  const sameAs = [instagramUrl(settings.instagram)].filter(Boolean) as string[];

  const storeSchema = {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${siteUrl()}/#store`,
    name: brand,
    url: siteUrl(),
    description,
    image: absoluteUrl(settings.home_hero_image_url, "/brand-mark.svg"),
    logo: absoluteUrl(settings.brand_logo_url, "/brand-mark.svg"),
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.support_email ? { email: settings.support_email } : {}),
    ...(settings.opening_hours ? { openingHours: settings.opening_hours } : {}),
    address: {
      "@type": "PostalAddress",
      ...(settings.store_address ? { streetAddress: settings.store_address } : {}),
      addressLocality: "Nice",
      addressCountry: "FR",
    },
    ...(sameAs.length ? { sameAs } : {}),
  };

  const structuredData = JSON.stringify(storeSchema).replace(/</g, "\\u003c");

  return (
    <html lang="fr" style={themeStyle}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
        />
        <Providers siteSettings={settings}>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
