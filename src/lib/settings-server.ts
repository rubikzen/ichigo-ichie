import { unstable_cache } from "next/cache";
import { getSiteSettings, toPublicSiteSettings, type SiteSettings } from "@/lib/settings";

const getCachedSettings = unstable_cache(
  async () => getSiteSettings(),
  ["ichigo-site-settings-v263"],
  { revalidate: 60, tags: ["site-settings"] },
);

export async function getCachedSiteSettings(): Promise<SiteSettings> {
  return getCachedSettings();
}

export async function getPublicSiteSettings(): Promise<SiteSettings> {
  return toPublicSiteSettings(await getCachedSettings());
}
