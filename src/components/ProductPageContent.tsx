"use client";

import Link from "next/link";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { useLanguage } from "@/components/LanguageProvider";

export function ProductPageContent({
  product,
  categoryNameFr,
  categoryNameEn,
}: {
  product: Product;
  categoryNameFr: string;
  categoryNameEn: string;
}) {
  const { language } = useLanguage();
  const name =
    (language === "fr" ? product.name_fr : product.name_en) || product.name_fr;
  const description =
    (language === "fr" ? product.description_fr : product.description_en) ||
    product.description_fr ||
    "";
  const longDescription =
    (language === "fr"
      ? product.long_description_fr
      : product.long_description_en) || description;
  const categoryName =
    (language === "fr" ? categoryNameFr : categoryNameEn) || categoryNameFr;

  return (
    <main className="product-page-v431" data-product-page-v431>
      <div className="product-page-shell-v431">
        <nav
          className="product-page-breadcrumb-v431"
          aria-label={language === "fr" ? "Fil d’Ariane" : "Breadcrumb"}
        >
          <Link href="/">{language === "fr" ? "Accueil" : "Home"}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/#boutique">Boutique</Link>
          {categoryName && (
            <>
              <span aria-hidden="true">/</span>
              <span>{categoryName}</span>
            </>
          )}
        </nav>

        <section className="product-page-hero-v431">
          <div className="product-page-purchase-v431">
            <ProductCard product={product} />
          </div>

          <article className="product-page-story-v431">
            <p className="eyebrow">
              {product.badge ||
                (language === "fr"
                  ? "Sélection Ichigo Ichie"
                  : "Ichigo Ichie selection")}
            </p>
            <h1>{name}</h1>
            {description && (
              <p className="product-page-lead-v431">{description}</p>
            )}

            {(product.origin ||
              product.cultivar ||
              product.ideal_for.length > 0) && (
              <dl className="product-page-facts-v431">
                {product.origin && (
                  <div>
                    <dt>{language === "fr" ? "Origine" : "Origin"}</dt>
                    <dd>{product.origin}</dd>
                  </div>
                )}
                {product.cultivar && (
                  <div>
                    <dt>Cultivar</dt>
                    <dd>{product.cultivar}</dd>
                  </div>
                )}
                {product.ideal_for.length > 0 && (
                  <div className="product-page-ideal-v431">
                    <dt>{language === "fr" ? "Idéal pour" : "Ideal for"}</dt>
                    <dd>
                      {product.ideal_for.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {longDescription && longDescription !== description && (
              <section className="product-page-description-v431">
                <h2>
                  {language === "fr"
                    ? "À propos de ce produit"
                    : "About this product"}
                </h2>
                <p>{longDescription}</p>
              </section>
            )}

            <div className="product-page-trust-v431">
              <span>✓ {language === "fr" ? "Paiement sécurisé" : "Secure payment"}</span>
              <span>✓ {language === "fr" ? "Expédition depuis la France" : "Ships from France"}</span>
            </div>
          </article>
        </section>

        <div className="product-page-back-v431">
          <Link href="/#boutique">
            ← {language === "fr" ? "Retour à la boutique" : "Back to shop"}
          </Link>
        </div>
      </div>
    </main>
  );
}
