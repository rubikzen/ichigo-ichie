import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteChrome } from "@/components/SiteChrome";
import { getCachedSiteSettings, getPublicSiteSettings } from "@/lib/settings-server";

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

function schemaStreetAddress(value: string | undefined) {
  const raw = String(value || "").trim();
  return (raw.split("·")[0] || raw || "14 rue Centrale").trim();
}

function schemaOpeningHours(value: string | undefined) {
  const raw = String(value || "").trim();
  const match = raw.match(/(\d{1,2})\s*h(?:\s*(\d{2}))?.*?(\d{1,2})\s*h(?:\s*(\d{2}))?/i);
  if (!match) return raw || undefined;
  const start = `${match[1].padStart(2, "0")}:${(match[2] || "00").padStart(2, "0")}`;
  const end = `${match[3].padStart(2, "0")}:${(match[4] || "00").padStart(2, "0")}`;
  return `Mo-Su ${start}-${end}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSiteSettings();
  const brand = settings.brand_name || "ICHIGO ICHIE";
  const title = settings.seo_title || "Ichigo Ichie | Matcha japonais à Nice";
  const description = settings.seo_description || "Maison de matcha japonais dans le Vieux Nice : matcha latte, boissons japonaises, matcha cérémonie et accessoires. Découvrez notre carte et notre boutique en ligne.";
  const previewImage = absoluteUrl(settings.home_hero_image_url, "/brand-mark.svg");
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

  return {
    metadataBase: new URL(siteUrl()),
    applicationName: brand,
    title: { default: title, template: `%s · ${brand}` },
    description,
    keywords: [
      "matcha Nice",
      "matcha japonais Nice",
      "matcha latte Nice",
      "salon de thé japonais Nice",
      "matcha cérémonie",
      "thé matcha japonais",
      "Vieux Nice",
      "Ichigo Ichie Nice",
    ],
    category: "food and drink",
    creator: brand,
    publisher: brand,
    alternates: { canonical: "/" },
    formatDetection: { email: false, address: false, telephone: false },
    icons: { icon: "/brand-mark.svg", shortcut: "/brand-mark.svg", apple: "/brand-mark.svg" },
    ...(googleVerification ? { verification: { google: googleVerification } } : {}),
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: brand,
      url: "/",
      title,
      description,
      images: [{ url: previewImage, alt: `${brand} — Maison de matcha japonais à Nice` }],
    },
    twitter: { card: "summary_large_image", title, description, images: [previewImage] },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSiteSettings();
  const themeStyle = {
    "--ink": settings.theme_ink || "#26362d",
    "--moss": settings.theme_moss || "#486a4b",
    "--moss-dark": settings.theme_moss_dark || "#294237",
    "--paper": settings.theme_paper || "#fffdf8",
    "--soft": settings.theme_soft || "#f5f2e8",
    "--radius": `${Number(settings.theme_radius || 26)}px`,
  } as CSSProperties;

  const brand = settings.brand_name || "ICHIGO ICHIE";
  const description = settings.seo_description || "Maison de matcha japonais dans le Vieux Nice : matcha latte, boissons japonaises, matcha cérémonie et accessoires. Découvrez notre carte et notre boutique en ligne.";
  const sameAs = [instagramUrl(settings.instagram)].filter(Boolean) as string[];
  const openingHours = schemaOpeningHours(settings.opening_hours);
  const storeSchema = {
    "@context": "https://schema.org",
    "@type": ["CafeOrCoffeeShop", "Store"],
    "@id": `${siteUrl()}/#store`,
    name: brand,
    url: siteUrl(),
    description,
    image: absoluteUrl(settings.home_hero_image_url, "/brand-mark.svg"),
    logo: absoluteUrl(settings.brand_logo_url, "/brand-mark.svg"),
    servesCuisine: ["Japanese", "Matcha", "Tea"],
    areaServed: { "@type": "City", name: "Nice" },
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.support_email ? { email: settings.support_email } : {}),
    ...(openingHours ? { openingHours } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: schemaStreetAddress(settings.store_address),
      postalCode: "06300",
      addressLocality: "Nice",
      addressRegion: "Provence-Alpes-Côte d’Azur",
      addressCountry: "FR",
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
  const websiteSchema = {
    "@type": "WebSite",
    "@id": `${siteUrl()}/#website`,
    url: siteUrl(),
    name: brand,
    publisher: { "@id": `${siteUrl()}/#store` },
    inLanguage: ["fr-FR", "en"],
  };
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [storeSchema, websiteSchema],
  }).replace(/</g, "\\u003c");

  return (
    <html lang="fr" style={themeStyle}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
        <Providers siteSettings={settings}>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
