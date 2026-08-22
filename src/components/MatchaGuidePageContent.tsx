"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { SafeImage } from "@/components/SafeImage";
import type { Product } from "@/lib/types";
import type { MatchaGuide } from "@/lib/matcha-guides";
import { SeoBreadcrumbs } from "@/components/SeoBreadcrumbs";

export function MatchaGuidePageContent({
  guide,
  products,
}: {
  guide: MatchaGuide;
  products: Product[];
}) {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <article className="matcha-guide-page-v469">
      <div className="matcha-guide-shell-v469">
        <SeoBreadcrumbs
          className="matcha-guide-breadcrumb-v469"
          ariaLabel={fr ? "Fil d’Ariane" : "Breadcrumb"}
          items={[
            { href: "/", label: fr ? "Accueil" : "Home" },
            {
              href: "/guides",
              label: fr ? "Guides du matcha" : "Matcha guides",
            },
            { label: fr ? guide.titleFr : guide.titleEn },
          ]}
        />

        <header className="matcha-guide-article-hero-v469">
          <p className="eyebrow">{fr ? guide.eyebrowFr : guide.eyebrowEn}</p>
          <h1>{fr ? guide.titleFr : guide.titleEn}</h1>
          <p className="matcha-guide-lead-v469">{fr ? guide.introFr : guide.introEn}</p>
          <div className="matcha-guide-meta-v469">
            <span>{guide.readingMinutes} min · {fr ? "lecture" : "read"}</span>
            <span>Ichigo Ichie · Nice</span>
            <time dateTime={guide.updatedAt}>
              {fr ? "Mis à jour" : "Updated"} · 22/08/2026
            </time>
          </div>
        </header>

        <section className="matcha-guide-takeaways-v469" aria-labelledby="matcha-guide-summary-v469">
          <p className="eyebrow">{fr ? "EN BREF" : "IN SHORT"}</p>
          <h2 id="matcha-guide-summary-v469">
            {fr ? "Les points essentiels" : "Key takeaways"}
          </h2>
          <ul>
            {(fr ? guide.takeawaysFr : guide.takeawaysEn).map((item) => (
              <li key={item}><span aria-hidden="true">✓</span><span>{item}</span></li>
            ))}
          </ul>
        </section>

        <div className="matcha-guide-body-v469">
          {guide.sections.map((section) => (
            <section key={section.titleFr}>
              <h2>{fr ? section.titleFr : section.titleEn}</h2>
              {(fr ? section.bodyFr : section.bodyEn).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {(fr ? section.bulletsFr : section.bulletsEn)?.length ? (
                <ul>
                  {(fr ? section.bulletsFr : section.bulletsEn)?.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {(fr ? section.noteFr : section.noteEn) && (
                <aside>{fr ? section.noteFr : section.noteEn}</aside>
              )}
            </section>
          ))}
        </div>

        {products.length > 0 && (
          <section className="matcha-guide-products-v469" aria-labelledby="matcha-guide-products-title-v469">
            <div className="matcha-guide-section-head-v469">
              <div>
                <p className="eyebrow">{fr ? "À DÉCOUVRIR" : "EXPLORE"}</p>
                <h2 id="matcha-guide-products-title-v469">
                  {fr ? "Matchas liés à ce guide" : "Matcha related to this guide"}
                </h2>
                <p>
                  {fr
                    ? "Sélection dynamique à partir des usages indiqués dans notre catalogue actuel."
                    : "A dynamic selection based on the intended uses in our current catalogue."}
                </p>
              </div>
              <Link href="/#boutique">{fr ? "Toute la Boutique →" : "Full Shop →"}</Link>
            </div>

            <div className="matcha-guide-products-grid-v469">
              {products.map((product) => (
                <Link
                  key={product.id}
                  className="matcha-guide-product-v469"
                  href={`/boutique/${encodeURIComponent(product.slug.trim().toLowerCase())}`}
                >
                  <div className="matcha-guide-product-media-v469">
                    <SafeImage
                      src={product.image_url || "/product-placeholder.svg"}
                      alt=""
                      fill
                      sizes="(max-width: 700px) 30vw, 180px"
                    />
                  </div>
                  <div>
                    <strong>{fr ? product.name_fr : product.name_en || product.name_fr}</strong>
                    {product.origin && <small>{product.origin}</small>}
                    {product.ideal_for.length > 0 && (
                      <span>{product.ideal_for.slice(0, 3).join(" · ")}</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="matcha-guide-faq-v469" aria-labelledby="matcha-guide-faq-title-v469">
          <p className="eyebrow">FAQ</p>
          <h2 id="matcha-guide-faq-title-v469">
            {fr ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <div>
            {guide.faq.map((faq) => (
              <details key={faq.questionFr}>
                <summary>{fr ? faq.questionFr : faq.questionEn}</summary>
                <p>{fr ? faq.answerFr : faq.answerEn}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="matcha-guide-next-v469">
          <div>
            <p className="eyebrow">{fr ? "CONTINUER" : "KEEP LEARNING"}</p>
            <h2>{fr ? "Explorer les autres guides" : "Explore the other guides"}</h2>
          </div>
          <div>
            <Link href="/guides">{fr ? "Tous les guides" : "All guides"}</Link>
            <Link href="/matcha-nice">{fr ? "Matcha à Nice" : "Matcha in Nice"}</Link>
            <Link href="/#boutique">{fr ? "Choisir un matcha" : "Choose matcha"}</Link>
          </div>
        </section>
      </div>
    </article>
  );
}
