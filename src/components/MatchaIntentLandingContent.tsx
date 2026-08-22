"use client";

import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ReviewSummaryProvider } from "@/components/ReviewSummaryProvider";
import { useLanguage } from "@/components/LanguageProvider";
import type { MatchaIntentPage } from "@/lib/matcha-intent-pages";
import type { MatchaIntentSummary } from "@/lib/matcha-intent-index";
import type { Product } from "@/lib/types";
import { SeoBreadcrumbs } from "@/components/SeoBreadcrumbs";

export function MatchaIntentLandingContent({
  page,
  products,
  relatedPages,
}: {
  page: MatchaIntentPage;
  products: Product[];
  relatedPages: MatchaIntentSummary[];
}) {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <main className="matcha-intent-page-v470">
      <div className="matcha-intent-shell-v470">
        <SeoBreadcrumbs
          className="matcha-intent-breadcrumb-v470"
          ariaLabel={fr ? "Fil d’Ariane" : "Breadcrumb"}
          items={[
            { href: "/", label: fr ? "Accueil" : "Home" },
            {
              href: "/guides",
              label: fr ? "Guides du matcha" : "Matcha guides",
            },
            { label: fr ? page.labelFr : page.labelEn },
          ]}
        />

        <header className="matcha-intent-hero-v470">
          <p className="eyebrow">{fr ? page.eyebrowFr : page.eyebrowEn}</p>
          <h1>{fr ? page.titleFr : page.titleEn}</h1>
          <p className="matcha-intent-lead-v470">
            {fr ? page.introFr : page.introEn}
          </p>
          <div className="matcha-intent-facts-v470">
            {(fr ? page.factsFr : page.factsEn).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
        </header>

        <section
          className="matcha-intent-products-v470"
          aria-labelledby="matcha-intent-products-title-v470"
        >
          <div className="matcha-intent-section-head-v470">
            <div>
              <p className="eyebrow">
                {fr ? "SÉLECTION ACTUELLE" : "CURRENT SELECTION"}
              </p>
              <h2 id="matcha-intent-products-title-v470">
                {fr ? page.selectionTitleFr : page.selectionTitleEn}
              </h2>
              <p>
                {fr ? page.selectionIntroFr : page.selectionIntroEn}
              </p>
            </div>
            <span>
              {products.length}{" "}
              {fr
                ? products.length > 1
                  ? "références"
                  : "référence"
                : products.length === 1
                  ? "matcha"
                  : "matcha"}
            </span>
          </div>

          {products.length > 0 ? (
            <ReviewSummaryProvider
              productIds={products.map((product) => product.id)}
            >
              <div className="product-grid matcha-intent-grid-v470">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </ReviewSummaryProvider>
          ) : (
            <div className="matcha-intent-empty-v470">
              <strong>
                {fr
                  ? "Aucune référence disponible dans cette sélection pour le moment."
                  : "No products are currently available in this selection."}
              </strong>
              <p>
                {fr
                  ? "Le catalogue évolue. Vous pouvez consulter tous nos matchas ou le guide associé."
                  : "The catalogue changes over time. You can browse all matcha or read the related guide."}
              </p>
              <div>
                <Link className="button primary" href="/#boutique">
                  {fr ? "Voir toute la Boutique" : "Browse the full Shop"}
                </Link>
                <Link className="button ghost" href={page.guideHref}>
                  {fr ? "Lire le guide" : "Read the guide"}
                </Link>
              </div>
            </div>
          )}
        </section>

        <div className="matcha-intent-editorial-v470">
          {page.sections.map((section) => (
            <section key={section.titleFr}>
              <h2>{fr ? section.titleFr : section.titleEn}</h2>
              {(fr ? section.paragraphsFr : section.paragraphsEn).map(
                (paragraph) => <p key={paragraph}>{paragraph}</p>,
              )}
              {(fr ? section.bulletsFr : section.bulletsEn)?.length ? (
                <ul>
                  {(fr ? section.bulletsFr : section.bulletsEn)?.map(
                    (item) => <li key={item}>{item}</li>,
                  )}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section
          className="matcha-intent-faq-v470"
          aria-labelledby="matcha-intent-faq-title-v470"
        >
          <p className="eyebrow">FAQ</p>
          <h2 id="matcha-intent-faq-title-v470">
            {fr ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <div>
            {page.faq.map((faq) => (
              <details key={faq.questionFr}>
                <summary>{fr ? faq.questionFr : faq.questionEn}</summary>
                <p>{fr ? faq.answerFr : faq.answerEn}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="matcha-intent-related-v470">
          <div>
            <p className="eyebrow">
              {fr ? "APPROFONDIR" : "LEARN & COMPARE"}
            </p>
            <h2>
              {fr
                ? "Comparer avant de choisir"
                : "Compare before choosing"}
            </h2>
          </div>
          <div className="matcha-intent-related-links-v470">
            <Link href={page.guideHref}>
              {fr ? "Lire le guide associé →" : "Read the related guide →"}
            </Link>
            <Link href="/matcha-nice">
              {fr ? "Matcha à Nice →" : "Matcha in Nice →"}
            </Link>
            {relatedPages.map((related) => (
              <Link key={related.href} href={related.href}>
                {fr ? related.titleFr : related.titleEn} →
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
