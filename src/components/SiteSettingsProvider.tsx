"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { siteSettingDefaults, type SiteSettings } from "@/lib/settings";
import { subscribeSiteSettingsUpdate } from "@/lib/settings-events";

type SettingsContextValue = { settings: SiteSettings; refreshSettings: () => Promise<void> };
const SiteSettingsContext = createContext<SettingsContextValue>({ settings: siteSettingDefaults, refreshSettings: async () => undefined });

export function SiteSettingsProvider({ initialSettings, children }: { initialSettings: SiteSettings; children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({ ...siteSettingDefaults, ...initialSettings });
  const supabase = useMemo(() => createBrowserSupabase(), []);

  async function refreshSettings() {
    if (!supabase) return;
    const { data } = await supabase.from("site_settings").select("key,value");
    if (!data) return;
    const values = Object.fromEntries(data.map((row) => [row.key, typeof row.value === "string" ? row.value : String(row.value ?? "")]));
    setSettings({ ...siteSettingDefaults, ...values });
  }

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--ink", settings.theme_ink || "#26362d");
    root.setProperty("--moss", settings.theme_moss || "#486a4b");
    root.setProperty("--moss-dark", settings.theme_moss_dark || "#294237");
    root.setProperty("--paper", settings.theme_paper || "#fffdf8");
    root.setProperty("--soft", settings.theme_soft || "#f5f2e8");
    root.setProperty("--radius", `${Number(settings.theme_radius || 26)}px`);
  }, [settings]);

  useEffect(() => subscribeSiteSettingsUpdate(() => { refreshSettings(); }), [supabase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onFocus = () => { refreshSettings(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  return <SiteSettingsContext.Provider value={{ settings, refreshSettings }}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() { return useContext(SiteSettingsContext); }
