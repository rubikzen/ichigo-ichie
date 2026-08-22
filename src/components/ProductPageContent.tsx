"use client";
import { ProductReviews } from "@/components/ProductReviews";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { SafeImage } from "@/components/SafeImage";
import { useLanguage } from "@/components/LanguageProvider";
import { sanitizeStorefrontProductText } from "@/lib/product-content";
import { trackConversion } from "@/lib/conversion-analytics";
import { ProductGuideLinks } from "@/components/ProductGuideLinks";

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
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    trackConversion(
      "product_view",
      {
        product_id: product.id,
        value: product.base_price,
        currency: "EUR",
        source: "product_page",
      },
      { dedupeKey: `product_view:page:${product.id}` },
    );
  }, [product.id, product.base_price]);

  const name =
    (language === "fr" ? product.name_fr : product.name_en) || product.name_fr;
  const description = sanitizeStorefrontProductText(
    (language === "fr" ? product.description_fr : product.description_en) ||
      product.description_fr ||
      "",
  );
  const longDescription =
    sanitizeStorefrontProductText(
      language === "fr" ? product.long_description_fr : product.long_description_en,
    ) || description;
  const categoryName =
    (language === "fr" ? categoryNameFr : categoryNameEn) || categoryNameFr;

  const imageRows = [...(product.images ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const gallery = imageRows.length
    ? imageRows.map((image) => image.url)
    : [product.image_url || "/product-placeholder.svg"];
  const activeImage =
    gallery[Math.min(imageIndex, gallery.length - 1)] ||
    "/product-placeholder.svg";

  return (
    <main
      className="product-page-v431 product-page-v432 product-page-v459"
      data-product-page-v431
      data-product-page-v432
      data-product-page-v459
    >
      <div className="product-page-shell-v431 product-page-shell-v432">
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

        <header className="product-page-story-v431 product-page-header-v432">
          <p className="eyebrow">
            {product.badge ||
              (language === "fr"
                ? "Sélection Ichigo Ichie"
                : "Ichigo Ichie selection")}
          </p>
          <h1>{name}</h1>
          {description && (
            <p className="product-page-lead-v431 product-page-lead-v432">
              {description}
            </p>
          )}
          <a
            className="product-page-mobile-buy-link-v459"
            href="#product-purchase-v459"
          >
            <span>
              {product.variants.filter((variant) => variant.active).length > 1
                ? language === "fr"
                  ? "Choisir mon format"
                  : "Choose my format"
                : language === "fr"
                  ? "Acheter ce produit"
                  : "Buy this product"}
            </span>
            <span aria-hidden="true">↓</span>
          </a>
        </header>

        <section className="product-page-hero-v431 product-page-grid-v432">
          <div
            className="product-page-gallery-v432"
            aria-label={language === "fr" ? "Photos du produit" : "Product photos"}
          >
            <div className="product-page-gallery-stage-v432">
              <SafeImage
                src={activeImage}
                alt={`${name} ${imageIndex + 1}`}
                fill
                sizes="(max-width: 860px) calc(100vw - 28px), (max-width: 1280px) 52vw, 620px"
                priority
              />

              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    className="product-page-gallery-arrow-v432 previous"
                    aria-label={
                      language === "fr" ? "Image précédente" : "Previous image"
                    }
                    onClick={() =>
                      setImageIndex(
                        (current) =>
                          (current - 1 + gallery.length) % gallery.length,
                      )
                    }
                  >
                    {"‹"}
                  </button>
                  <button
                    type="button"
                    className="product-page-gallery-arrow-v432 next"
                    aria-label={
                      language === "fr" ? "Image suivante" : "Next image"
                    }
                    onClick={() =>
                      setImageIndex((current) => (current + 1) % gallery.length)
                    }
                  >
                    {"›"}
                  </button>
                  <span className="product-page-gallery-count-v432">
                    {imageIndex + 1} / {gallery.length}
                  </span>
                </>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="product-page-thumbnails-v432">
                {gallery.slice(0, 4).map((url, index) => (
                  <button
                    type="button"
                    key={`${url}-${index}`}
                    className={imageIndex === index ? "active" : ""}
                    aria-label={
                      language === "fr"
                        ? `Afficher la photo ${index + 1}`
                        : `Show photo ${index + 1}`
                    }
                    aria-pressed={imageIndex === index}
                    onClick={() => setImageIndex(index)}
                  >
                    <SafeImage
                      src={url}
                      alt=""
                      width={180}
                      height={180}
                      sizes="84px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="product-page-side-v432">
            <section
              id="product-purchase-v459"
              className="product-page-buy-box-v432 product-page-buy-box-v459"
              aria-label={language === "fr" ? "Acheter ce produit" : "Buy this product"}
            >
              <div className="product-page-buy-intro-v432">
                <span>
                  {language === "fr" ? "Commander en ligne" : "Order online"}
                </span>
                <strong>
                  {product.variants.filter((variant) => variant.active).length > 1
                    ? language === "fr"
                      ? "Choisissez votre format"
                      : "Choose your format"
                    : language === "fr"
                      ? "Ajouter à votre panier"
                      : "Add to your cart"}
                </strong>
              </div>

              <div
                className="product-page-purchase-v431 product-page-purchase-v432"
                data-product-purchase-v432
              >
                <ProductCard product={product} />
              </div>

              <div className="product-page-service-v432">
                <span>
                  <b aria-hidden="true">✓</b>
                  {language === "fr"
                    ? "Paiement sécurisé"
                    : "Secure payment"}
                </span>
                <span>
                  <b aria-hidden="true">✓</b>
                  {product.pickup_only
                    ? language === "fr"
                      ? "Retrait à Nice"
                      : "Pickup in Nice"
                    : language === "fr"
                      ? "Livraison France métropolitaine"
                      : "Delivery across metropolitan France"}
                </span>
              </div>
            </section>

            {(product.origin ||
              product.cultivar ||
              product.ideal_for.length > 0) && (
              <dl className="product-page-facts-v431 product-page-facts-v432">
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
                  <div className="product-page-ideal-v431 product-page-ideal-v432">
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
          </aside>
        </section>

        {longDescription && longDescription !== description && (
          <section className="product-page-description-v431 product-page-description-v432">
            <p className="eyebrow">
              {language === "fr" ? "LE PRODUIT" : "THE PRODUCT"}
            </p>
            <h2>
              {language === "fr"
                ? "À propos de ce produit"
                : "About this product"}
            </h2>
            <p>{longDescription}</p>
          </section>
        )}

        <ProductGuideLinks product={product} />

        <div className="product-page-back-v431 product-page-back-v432">
          <Link href="/#boutique">
            ← {language === "fr" ? "Retour à la boutique" : "Back to shop"}
          </Link>
        </div>
      </div>
          <ProductReviews productId={product.id} />
</main>
  );
}
