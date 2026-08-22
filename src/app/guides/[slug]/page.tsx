import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MatchaGuidePageContent } from "@/components/MatchaGuidePageContent";
import { getCachedCatalog } from "@/lib/catalog-server";
import { MATCHA_GUIDES, getMatchaGuide } from "@/lib/matcha-guides";
import { productMatchaFinderTags } from "@/lib/product-merchandising";

export const revalidate = 3600;

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

export function generateStaticParams() {
  return MATCHA_GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getMatchaGuide(slug);
  if (!guide) return {};

  return {
    title: guide.titleFr,
    description: guide.descriptionFr,
    alternates: { canonical: guide.href },
    openGraph: {
      type: "article",
      title: `${guide.titleFr} | Ichigo Ichie`,
      description: guide.descriptionFr,
      url: guide.href,
      publishedTime: guide.updatedAt,
      modifiedTime: guide.updatedAt,
      authors: ["Ichigo Ichie"],
      tags: ["matcha japonais", "matcha", "Nice"],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.titleFr,
      description: guide.descriptionFr,
    },
  };
}

export default async function MatchaGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getMatchaGuide(slug);
  if (!guide) notFound();

  const shop = await getCachedCatalog("shop");
  const tagSet = new Set(guide.recommendedTags);
  const matchingProducts = shop.products
    .filter(
      (product) =>
        product.type === "product" &&
        productMatchaFinderTags(product).some((tag) => tagSet.has(tag)),
    )
    .sort((a, b) => {
      const aScore = productMatchaFinderTags(a).filter((tag) => tagSet.has(tag)).length;
      const bScore = productMatchaFinderTags(b).filter((tag) => tagSet.has(tag)).length;
      if (aScore !== bScore) return bScore - aScore;

      const aActiveVariants = a.variants.filter((variant) => variant.active);
      const bActiveVariants = b.variants.filter((variant) => variant.active);
      const aStock = aActiveVariants.length
        ? aActiveVariants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock)), 0)
        : Math.max(0, Number(a.stock));
      const bStock = bActiveVariants.length
        ? bActiveVariants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock)), 0)
        : Math.max(0, Number(b.stock));

      return Number(bStock > 0) - Number(aStock > 0);
    })
    .slice(0, 3);

  const base = siteUrl();
  const pageUrl = `${base}${guide.href}`;

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        headline: guide.titleFr,
        description: guide.descriptionFr,
        datePublished: guide.updatedAt,
        dateModified: guide.updatedAt,
        inLanguage: "fr-FR",
        mainEntityOfPage: { "@id": pageUrl },
        author: {
          "@type": "Organization",
          name: "Ichigo Ichie",
          url: base,
        },
        publisher: { "@id": `${base}/#store` },
        about: [
          { "@type": "Thing", name: "Matcha japonais" },
          { "@type": "Thing", name: "Thé japonais" },
        ],
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
          {
            "@type": "ListItem",
            position: 3,
            name: guide.titleFr,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faq.map((faq) => ({
          "@type": "Question",
          name: faq.questionFr,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answerFr,
          },
        })),
      },
    ],
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
      <MatchaGuidePageContent guide={guide} products={matchingProducts} />
    </>
  );
}
