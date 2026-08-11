import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getCachedSiteSettings } from "@/lib/settings-server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
};

export default async function Page() {
  const settings = await getCachedSiteSettings();
  return (
    <LegalPage
      content={{
        titleFr: settings["privacy_title_fr"] || "",
        titleEn: settings["privacy_title_en"] || settings["privacy_title_fr"] || "",
        bodyFr: settings["privacy_body_fr"] || "",
        bodyEn: settings["privacy_body_en"] || settings["privacy_body_fr"] || "",
      }}
    />
  );
}
