import { redirect } from "next/navigation";
import { settingEnabled } from "@/lib/settings";
import { getPublicSiteSettings } from "@/lib/settings-server";

export default async function MenuPage() {
  const settings = await getPublicSiteSettings();
  redirect(settingEnabled(settings.menu_visible) ? "/#menu" : "/#boutique");
}
