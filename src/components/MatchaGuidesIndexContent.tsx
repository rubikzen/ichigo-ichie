"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { MATCHA_GUIDE_SUMMARIES } from "@/lib/matcha-guide-index";
import { MATCHA_INTENT_SUMMARIES } from "@/lib/matcha-intent-index";

export function MatchaGuidesIndexContent() {
  const { language } = useLanguage();

  return (
    <div className="matcha-guides-page-v469">
      <div className="matcha-guides-shell-v469">
        <nav className="matcha-guide-breadcrumb-v469" aria-label={language === "fr" ? "Fil d’Ariane" : "Breadcrumb"}>
          <Link href="/">{language === "fr" ? "Accueil" : "Home"}</Link>
          <span aria-hidden="true">/</span>
          <span>{language === "fr" ? "Guides du matcha" : "Matcha guides"}</span>
        </nav>

        <header className="matcha-guides-hero-v469">
          <p className="eyebrow">{language === "fr" ? "APPRENDRE LE MATCHA" : "LEARN MATCHA"}</p>
          <h1>{language === "fr" ? "Guides du matcha japonais" : "Japanese matcha guides"}</h1>
          <p>
            {language === "fr"
              ? "Des repères simples pour choisir votre matcha, comprendre l’usucha et le koicha, puis préparer une tasse adaptée à votre goût."
              : "Simple, practical guidance for choosing matcha, understanding usucha and koicha, and preparing a cup that fits your taste."}
          </p>
        </header>

        <section className="matcha-guides-grid-v469" aria-label={language === "fr" ? "Tous les guides" : "All guides"}>
          {MATCHA_GUIDE_SUMMARIES.map((guide, index) => (
            <article key={guide.slug} className="matcha-guide-card-v469">
              <span className="matcha-guide-number-v469">{String(index + 1).padStart(2, "0")}</span>
              <p className="eyebrow">{language === "fr" ? guide.eyebrowFr : guide.eyebrowEn}</p>
              <h2>
                <Link href={guide.href}>
                  {language === "fr" ? guide.titleFr : guide.titleEn}
                </Link>
              </h2>
              <p>{language === "fr" ? guide.descriptionFr : guide.descriptionEn}</p>
              <div>
                <small>
                  {guide.readingMinutes} min · {language === "fr" ? "lecture" : "read"}
                </small>
                <Link href={guide.href}>
                  {language === "fr" ? "Lire le guide →" : "Read guide →"}
                </Link>
              </div>
            </article>
          ))}
        </section>

        <section className="matcha-guide-index-cta-v469">
          <div>
            <p className="eyebrow">{language === "fr" ? "PASSER À LA TASSE" : "FROM GUIDE TO CUP"}</p>
            <h2>{language === "fr" ? "Choisir selon votre usage" : "Choose for your ritual"}</h2>
            <p>
              {language === "fr"
                ? "Notre Boutique classe déjà les matchas par usages : quotidien, cérémonie, usucha, koicha et latte."
                : "Our Shop already organises matcha by use: daily, ceremonial, usucha, koicha and latte."}
            </p>
          </div>
          <div className="matcha-guide-intent-links-v470">
            {MATCHA_INTENT_SUMMARIES.map((intent) => (
              <Link key={intent.href} href={intent.href}>
                {language === "fr" ? intent.labelFr : intent.labelEn}
              </Link>
            ))}
            <Link className="button primary" href="/#boutique">
              {language === "fr" ? "Toute la Boutique" : "Full Shop"}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
