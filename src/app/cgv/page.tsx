import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getCachedSiteSettings } from "@/lib/settings-server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/cgv" },
};

export default async function Page() {
  const settings = await getCachedSiteSettings();
  return (
    <LegalPage
      content={{
        titleFr: settings["terms_title_fr"] || "",
        titleEn: settings["terms_title_en"] || settings["terms_title_fr"] || "",
        bodyFr: settings["terms_body_fr"] || "",
        bodyEn: settings["terms_body_en"] || settings["terms_body_fr"] || "",
      }}
    />
  );
}
