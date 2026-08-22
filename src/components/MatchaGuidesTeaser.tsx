"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { MATCHA_GUIDE_SUMMARIES } from "@/lib/matcha-guide-index";

export function MatchaGuidesTeaser() {
  const { language } = useLanguage();
  const fr = language === "fr";

  return (
    <section className="matcha-guides-teaser-v469" aria-labelledby="matcha-guides-teaser-title-v469">
      <div className="matcha-guides-teaser-head-v469">
        <div>
          <p className="eyebrow">{fr ? "GUIDES DU MATCHA" : "MATCHA GUIDES"}</p>
          <h2 id="matcha-guides-teaser-title-v469">
            {fr ? "Mieux choisir, mieux préparer" : "Choose better, prepare better"}
          </h2>
          <p>
            {fr
              ? "Des repères simples avant de choisir votre matcha."
              : "Simple guidance before choosing your matcha."}
          </p>
        </div>
        <Link href="/guides">{fr ? "Tous les guides →" : "All guides →"}</Link>
      </div>

      <div className="matcha-guides-teaser-grid-v469">
        {MATCHA_GUIDE_SUMMARIES.map((guide) => (
          <Link key={guide.slug} href={guide.href}>
            <small>{fr ? guide.eyebrowFr : guide.eyebrowEn}</small>
            <strong>{fr ? guide.titleFr : guide.titleEn}</strong>
            <span>{fr ? "Lire le guide →" : "Read guide →"}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
