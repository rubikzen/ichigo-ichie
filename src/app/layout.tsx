import type { CSSProperties } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getSiteSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: settings.seo_title || "Ichigo Ichie — Maison de Matcha à Nice",
    description: settings.seo_description || "Maison japonaise de matcha à Nice : carte sur place, matcha japonais et accessoires disponibles dans notre boutique en ligne.",
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSiteSettings();
  const themeStyle = {
    "--ink": settings.theme_ink || "#26362d",
    "--moss": settings.theme_moss || "#486a4b",
    "--moss-dark": settings.theme_moss_dark || "#294237",
    "--paper": settings.theme_paper || "#fffdf8",
    "--soft": settings.theme_soft || "#f5f2e8",
    "--radius": `${Number(settings.theme_radius || 26)}px`,
  } as CSSProperties;

  return (
    <html lang="fr" style={themeStyle}>
      <body>
        <Providers siteSettings={settings}>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
