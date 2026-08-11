import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Livraison & retours",
  alternates: { canonical: "/livraison-retours" },
};

export default function Page() {
  return <LegalPage titleKey="shipping_returns_title" bodyKey="shipping_returns_body" />;
}
