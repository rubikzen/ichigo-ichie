import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Conditions générales de vente",
  alternates: { canonical: "/cgv" },
};

export default function Page() {
  return <LegalPage titleKey="terms_title" bodyKey="terms_body" />;
}
