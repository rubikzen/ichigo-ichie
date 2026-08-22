import type { Metadata } from "next";
import { MatchaGuidesIndexContent } from "@/components/MatchaGuidesIndexContent";
import { MATCHA_GUIDE_SUMMARIES } from "@/lib/matcha-guide-index";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

export const metadata: Metadata = {
  title: "Guides du matcha japonais",
  description:
    "Guides Ichigo Ichie pour choisir son matcha japonais, comprendre usucha et koicha, et choisir entre matcha cérémonie et matcha latte.",
  alternates: { canonical: "/guides" },
  openGraph: {
    type: "website",
    title: "Guides du matcha japonais | Ichigo Ichie",
    description:
      "Choisir son matcha, comprendre l’usucha et le koicha, et préparer le matcha selon son usage.",
    url: "/guides",
  },
};

export default function MatchaGuidesPage() {
  const base = siteUrl();
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${base}/guides#page`,
        url: `${base}/guides`,
        name: "Guides du matcha japonais",
        description:
          "Guides pratiques Ichigo Ichie pour choisir et préparer le matcha japonais.",
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${base}/#website` },
      },
      {
        "@type": "ItemList",
        itemListElement: MATCHA_GUIDE_SUMMARIES.map((guide, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: guide.titleFr,
          url: `${base}${guide.href}`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Accueil",
            item: `${base}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Guides du matcha",
            item: `${base}/guides`,
          },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <MatchaGuidesIndexContent />
    </>
  );
}
