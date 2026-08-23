import type { Metadata } from "next";
import { WithdrawalPageClient } from "@/components/WithdrawalPageClient";

export const metadata: Metadata = {
  title: "Rétractation en ligne",
  description:
    "Fonctionnalité en ligne permettant de notifier une décision de rétractation relative à une commande Ichigo Ichie.",
  alternates: { canonical: "/retractation" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <WithdrawalPageClient />;
}
