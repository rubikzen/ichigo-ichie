import { MatchaIntentLandingContent } from "@/components/MatchaIntentLandingContent";
import { getCachedCatalog } from "@/lib/catalog-server";
import { getMatchaIntentPage } from "@/lib/matcha-intent-pages";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";
import { productMatchesFinderTag } from "@/lib/product-merchandising";
import type { MatchaIntentSummary } from "@/lib/matcha-intent-index";

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://www.ichigoichiematcha.fr"
  ).replace(/\/$/, "");
}

export async function MatchaIntentPageServer({
  tag,
}: {
  tag: MatchaIntentSummary["tag"];
}) {
  const page = getMatchaIntentPage(tag);
  if (!page) return null;

  const shop = await getCachedCatalog("shop");
  const products = shop.products.filter((product) =>
    productMatchesFinderTag(product, tag),
  );
  const relatedPages = MATCHA_INTENT_SUMMARIES.filter(
    (candidate) => candidate.tag !== tag,
  );

  const base = siteUrl();
  const pageUrl = `${base}${page.href}`;
  const itemList = products.map((product, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: product.name_fr,
    url: `${base}/boutique/${encodeURIComponent(
      product.slug.trim().toLowerCase(),
    )}`,
  }));

  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: page.titleFr,
        description: page.metaDescriptionFr,
        inLanguage: "fr-FR",
        isPartOf: { "@id": `${base}/#website` },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: itemList.length,
          itemListElement: itemList,
        },
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
            name: page.titleFr,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map((faq) => ({
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
      <MatchaIntentLandingContent
        page={page}
        products={products}
        relatedPages={relatedPages}
      />
    </>
  );
}
