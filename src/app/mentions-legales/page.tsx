import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { getCachedSiteSettings } from "@/lib/settings-server";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Mentions légales",
  alternates: { canonical: "/mentions-legales" },
};

export default async function Page() {
  const settings = await getCachedSiteSettings();
  return (
    <LegalPage
      content={{
        titleFr: settings["legal_notice_title_fr"] || "",
        titleEn: settings["legal_notice_title_en"] || settings["legal_notice_title_fr"] || "",
        bodyFr: settings["legal_notice_body_fr"] || "",
        bodyEn: settings["legal_notice_body_en"] || settings["legal_notice_body_fr"] || "",
      }}
    />
  );
}
