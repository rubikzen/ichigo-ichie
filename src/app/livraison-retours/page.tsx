import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getCachedSiteSettings } from "@/lib/settings-server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Livraison & retours",
  alternates: { canonical: "/livraison-retours" },
};

export default async function Page() {
  const settings = await getCachedSiteSettings();
  return (
    <LegalPage
      content={{
        titleFr: settings["shipping_returns_title_fr"] || "",
        titleEn: settings["shipping_returns_title_en"] || settings["shipping_returns_title_fr"] || "",
        bodyFr: settings["shipping_returns_body_fr"] || "",
        bodyEn: settings["shipping_returns_body_en"] || settings["shipping_returns_body_fr"] || "",
      }}
    />
  );
}
