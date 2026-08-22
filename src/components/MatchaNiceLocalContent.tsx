"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { ProductCard } from "@/components/ProductCard";
import { ReviewSummaryProvider } from "@/components/ReviewSummaryProvider";
import {
  MATCHA_NICE_SECTIONS,
  buildMatchaNiceFaq,
  type MatchaNiceStoreInfo,
} from "@/lib/matcha-nice-content";
import type { Product } from "@/lib/types";

function money(value: number, language: "fr" | "en") {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function MatchaNiceLocalContent({
  store,
  shopProducts,
  menuProducts,
}: {
  store: MatchaNiceStoreInfo;
  shopProducts: Product[];
  menuProducts: Product[];
}) {
  const { language } = useLanguage();
  const fr = language === "fr";
  const faq = buildMatchaNiceFaq(store);

  return (
    <main className="matcha-nice-page-v471">
      <div className="matcha-nice-shell-v471">
        <nav
          className="matcha-nice-breadcrumb-v471"
          aria-label={fr ? "Fil d’Ariane" : "Breadcrumb"}
        >
          <Link href="/">{fr ? "Accueil" : "Home"}</Link>
          <span aria-hidden="true">/</span>
          <span>{fr ? "Matcha à Nice" : "Matcha in Nice"}</span>
        </nav>

        <header className="matcha-nice-hero-v471">
          <div>
            <p className="eyebrow">
              {fr ? "ICHIGO ICHIE · VIEUX NICE" : "ICHIGO ICHIE · VIEUX NICE"}
            </p>
            <h1>
              {fr
                ? "Matcha japonais à Nice"
                : "Japanese matcha in Nice"}
            </h1>
            <p className="matcha-nice-lead-v471">
              {fr
                ? "Une maison dédiée au matcha dans le Vieux Nice : boissons et douceurs sur place, matcha japonais et accessoires à emporter, Boutique en ligne et retrait à Nice."
                : "A matcha house in Vieux Nice: drinks and Japanese sweets to enjoy in store, Japanese matcha and accessories to take home, online Shop and pickup in Nice."}
            </p>

            <div className="matcha-nice-hero-actions-v471">
              {store.mapsHref && (
                <a
                  className="button primary"
                  href={store.mapsHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {fr ? "Itinéraire" : "Directions"}
                </a>
              )}
              <Link className="button ghost" href="/#menu">
                {fr ? "Voir la carte" : "View menu"}
              </Link>
              <Link className="button ghost" href="/#boutique">
                {fr ? "Voir la Boutique" : "View Shop"}
              </Link>
            </div>
          </div>

          <aside className="matcha-nice-visit-card-v471">
            <p className="eyebrow">
              {fr ? "NOUS RENDRE VISITE" : "VISIT US"}
            </p>
            {store.address && (
              <div>
                <small>{fr ? "Adresse" : "Address"}</small>
                <strong>{store.address}</strong>
              </div>
            )}
            {store.openingHours && (
              <div>
                <small>{fr ? "Horaires" : "Opening hours"}</small>
                <strong>{store.openingHours}</strong>
              </div>
            )}
            {store.phone && (
              <div>
                <small>{fr ? "Téléphone" : "Phone"}</small>
                <a href={`tel:${store.phone.replace(/\s+/g, "")}`}>
                  {store.phone}
                </a>
              </div>
            )}
            {store.email && (
              <div>
                <small>E-mail</small>
                <a href={`mailto:${store.email}`}>{store.email}</a>
              </div>
            )}
            <div className="matcha-nice-visit-links-v471">
              {store.mapsHref && (
                <a href={store.mapsHref} target="_blank" rel="noreferrer">
                  Google Maps ↗
                </a>
              )}
              {store.instagramHref && (
                <a
                  href={store.instagramHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  Instagram ↗
                </a>
              )}
            </div>
          </aside>
        </header>

        <section className="matcha-nice-local-points-v471">
          <article>
            <span aria-hidden="true">01</span>
            <strong>{fr ? "Boire sur place" : "Drink in store"}</strong>
            <p>
              {fr
                ? "Découvrez la carte actuelle de boissons et douceurs japonaises."
                : "Explore the current menu of Japanese drinks and sweets."}
            </p>
          </article>
          <article>
            <span aria-hidden="true">02</span>
            <strong>{fr ? "Acheter du matcha" : "Buy matcha"}</strong>
            <p>
              {fr
                ? "Comparez les références, formats, usages et stocks du catalogue actuel."
                : "Compare current products, pack sizes, intended uses and stock."}
            </p>
          </article>
          <article>
            <span aria-hidden="true">03</span>
            <strong>{fr ? "Retrait à Nice" : "Pickup in Nice"}</strong>
            <p>
              {fr
                ? "Commandez les produits éligibles en ligne puis choisissez le retrait lorsque proposé au checkout."
                : "Order eligible products online and choose pickup when offered at checkout."}
            </p>
          </article>
        </section>

        {menuProducts.length > 0 && (
          <section
            className="matcha-nice-menu-v471"
            aria-labelledby="matcha-nice-menu-title-v471"
          >
            <div className="matcha-nice-section-head-v471">
              <div>
                <p className="eyebrow">
                  {fr ? "À BOIRE À NICE" : "DRINK IN NICE"}
                </p>
                <h2 id="matcha-nice-menu-title-v471">
                  {fr
                    ? "Matcha actuellement présent sur notre carte"
                    : "Matcha currently on our menu"}
                </h2>
                <p>
                  {fr
                    ? store.menuInfoFr
                    : store.menuInfoEn}
                </p>
              </div>
              <Link href="/#menu">
                {fr ? "Toute la carte →" : "Full menu →"}
              </Link>
            </div>

            <div className="matcha-nice-menu-grid-v471">
              {menuProducts.map((product) => (
                <article key={product.id}>
                  <div>
                    <strong>
                      {fr
                        ? product.name_fr
                        : product.name_en || product.name_fr}
                    </strong>
                    <p>
                      {(fr
                        ? product.description_fr
                        : product.description_en || product.description_fr) ||
                        ""}
                    </p>
                  </div>
                  <span>{money(product.base_price, language)}</span>
                </article>
              ))}
            </div>
          </section>
        )}

        <section
          className="matcha-nice-shop-v471"
          aria-labelledby="matcha-nice-shop-title-v471"
        >
          <div className="matcha-nice-section-head-v471">
            <div>
              <p className="eyebrow">
                {fr ? "BOUTIQUE MATCHA NICE" : "MATCHA SHOP NICE"}
              </p>
              <h2 id="matcha-nice-shop-title-v471">
                {fr
                  ? "Une sélection de matchas à découvrir"
                  : "A selection of matcha to discover"}
              </h2>
              <p>
                {fr
                  ? "Produits issus du catalogue actuel : prix, variantes, stock et avis utilisent les mêmes données que la Boutique principale."
                  : "Products come from the current catalogue: prices, variants, stock and reviews use the same data as the main Shop."}
              </p>
            </div>
            <Link href="/#boutique">
              {fr ? "Toute la Boutique →" : "Full Shop →"}
            </Link>
          </div>

          {shopProducts.length > 0 ? (
            <ReviewSummaryProvider
              productIds={shopProducts.map((product) => product.id)}
            >
              <div className="product-grid matcha-nice-product-grid-v471">
                {shopProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </ReviewSummaryProvider>
          ) : (
            <div className="matcha-nice-empty-v471">
              {fr
                ? "La sélection de matchas en ligne est momentanément vide. Consultez la Boutique pour le catalogue à jour."
                : "The online matcha selection is currently empty. Check the Shop for the latest catalogue."}
            </div>
          )}
        </section>

        <div className="matcha-nice-editorial-v471">
          {MATCHA_NICE_SECTIONS.map((section) => (
            <section key={section.titleFr}>
              <h2>{fr ? section.titleFr : section.titleEn}</h2>
              {(fr ? section.bodyFr : section.bodyEn).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <section
          className="matcha-nice-guide-links-v471"
          aria-labelledby="matcha-nice-guides-title-v471"
        >
          <div>
            <p className="eyebrow">
              {fr ? "CHOISIR SON MATCHA" : "CHOOSE YOUR MATCHA"}
            </p>
            <h2 id="matcha-nice-guides-title-v471">
              {fr
                ? "Préparer votre visite ou votre rituel"
                : "Plan your visit or home ritual"}
            </h2>
          </div>
          <div>
            <Link href="/guides/comment-choisir-son-matcha">
              {fr ? "Comment choisir son matcha ?" : "How to choose matcha"} →
            </Link>
            <Link href="/matcha-usucha">Usucha →</Link>
            <Link href="/matcha-koicha">Koicha →</Link>
            <Link href="/matcha-latte">
              {fr ? "Matcha pour latte" : "Matcha for latte"} →
            </Link>
            <Link href="/matcha-ceremonie">
              {fr ? "Matcha cérémonie" : "Ceremonial matcha"} →
            </Link>
          </div>
        </section>

        <section
          className="matcha-nice-faq-v471"
          aria-labelledby="matcha-nice-faq-title-v471"
        >
          <p className="eyebrow">FAQ</p>
          <h2 id="matcha-nice-faq-title-v471">
            {fr ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <div>
            {faq.map((item) => (
              <details key={item.questionFr}>
                <summary>{fr ? item.questionFr : item.questionEn}</summary>
                <p>{fr ? item.answerFr : item.answerEn}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
