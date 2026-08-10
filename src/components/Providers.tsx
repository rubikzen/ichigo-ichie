"use client";

import { LanguageProvider } from "./LanguageProvider";
import { CartProvider } from "./CartProvider";
import { SiteSettingsProvider } from "./SiteSettingsProvider";
import type { SiteSettings } from "@/lib/settings";

export function Providers({ children, siteSettings }: { children: React.ReactNode; siteSettings: SiteSettings }) {
  return <LanguageProvider><SiteSettingsProvider initialSettings={siteSettings}><CartProvider>{children}</CartProvider></SiteSettingsProvider></LanguageProvider>;
}
