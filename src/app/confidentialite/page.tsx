import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  alternates: { canonical: "/confidentialite" },
};

export default function Page() {
  return <LegalPage titleKey="privacy_title" bodyKey="privacy_body" />;
}
