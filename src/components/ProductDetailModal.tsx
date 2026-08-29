"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Product, Variant } from "@/lib/types";
import { packagingLabel, productVariantLabel, variantLabel } from "@/lib/product-label";
import { SafeImage } from "./SafeImage";
import { RestockNotify } from "./RestockNotify";

export type ProductModalPackagingKey = "can" | "bag" | "other";

export type ProductModalPackageOption = {
  key: ProductModalPackagingKey;
  packaging: Variant["packaging"];
  available: boolean;
};

type ProductDetailModalProps = {
  product: Product;
  language: "fr" | "en";
  name: string;
  shortDescription: string;
  fullDescription: string;
  gallery: string[];
  image: string;
  imageIndex: number;
  setImageIndex: Dispatch<SetStateAction<number>>;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  packageOptions: ProductModalPackageOption[];
  selectedPackaging: ProductModalPackagingKey;
  onPackagingSelect: (key: ProductModalPackagingKey) => void;
  variantsForPackaging: Variant[];
  variantId: string;
  onVariantSelect: (variantId: string) => void;
  selectableVariants: Variant[];
  variant: Variant | null;
  currentStock: number;
  selected: Record<string, string[]>;
  onToggleOption: (groupId: string, valueId: string, max: number) => void;
  cartQuantity: number;
  justAdded: boolean;
  price: number;
  onDecreaseQuantity: () => void;
  onIncreaseQuantity: () => void;
  quantityInCartForStock: number;
  count: number;
  canAdd: boolean;
  stockLimitReached: boolean;
  onAdd: () => void;
};

const moneyFormatters = {
  fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }),
} as const;

const money = (value: number, language: "fr" | "en") =>
  moneyFormatters[language].format(value);

function stockCopy(stock: number, language: "fr" | "en") {
  if (stock <= 0) return language === "fr" ? "Rupture de stock" : "Sold out";
  if (stock <= 5) return language === "fr" ? `Plus que ${stock} en stock` : `Only ${stock} left`;
  return language === "fr" ? `${stock} en stock` : `${stock} in stock`;
}

export function ProductDetailModal({
  product,
  language,
  name,
  shortDescription,
  fullDescription,
  gallery,
  image,
  imageIndex,
  setImageIndex,
  closeButtonRef,
  onClose,
  packageOptions,
  selectedPackaging,
  onPackagingSelect,
  variantsForPackaging,
  variantId,
  onVariantSelect,
  selectableVariants,
  variant,
  currentStock,
  selected,
  onToggleOption,
  cartQuantity,
  justAdded,
  price,
  onDecreaseQuantity,
  onIncreaseQuantity,
  quantityInCartForStock,
  count,
  canAdd,
  stockLimitReached,
  onAdd,
}: ProductDetailModalProps) {
  const isShopProduct = product.type === "product" || product.type === "accessory";
  const hasProductFacts = Boolean(product.origin || product.cultivar || product.ideal_for.length);
  const showStock = isShopProduct;
  const hasStock = currentStock > 0;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [closeButtonRef]);

  return createPortal(
    <div className="modal-backdrop product-detail-backdrop" onMouseDown={onClose} role="presentation">
      <div className="product-modal product-modal-v28" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <button ref={closeButtonRef} className="modal-close" onClick={onClose} aria-label={language === "fr" ? "Fermer" : "Close"}>×</button>

        <div className="modal-media product-gallery-media product-gallery-v28">
          <div className="gallery-stage">
            <SafeImage
              src={image}
              alt={`${name} ${imageIndex + 1}`}
              fill
              sizes="(max-width: 720px) 100vw, (max-width: 1100px) 45vw, 540px"
            />
            {gallery.length > 1 && <>
              <button type="button" className="gallery-arrow previous" aria-label={language === "fr" ? "Image précédente" : "Previous image"} onClick={() => setImageIndex((current) => (current - 1 + gallery.length) % gallery.length)}>‹</button>
              <button type="button" className="gallery-arrow next" aria-label={language === "fr" ? "Image suivante" : "Next image"} onClick={() => setImageIndex((current) => (current + 1) % gallery.length)}>›</button>
            </>}
            {gallery.length > 1 && <span className="gallery-counter">{imageIndex + 1} / {gallery.length}</span>}
          </div>
          {gallery.length > 1 && <div className="gallery-thumbnails gallery-thumbnails-v28" aria-label={language === "fr" ? "Photos du produit" : "Product photos"}>
            {gallery.slice(0, 3).map((url, index) => <button type="button" key={`${url}-${index}`} className={imageIndex === index ? "active" : ""} onClick={() => setImageIndex(index)}><SafeImage src={url} alt="" width={240} height={180} sizes="(max-width: 720px) 30vw, 160px" /></button>)}
          </div>}
        </div>

        <div className="modal-content product-detail-content">
          <div className="product-detail-scroll">
            <header className="product-detail-header">
              {product.badge && <p className="eyebrow">{product.badge}</p>}
              <h2>{name}</h2>
              {shortDescription && <p className="product-detail-lead">{shortDescription}</p>}
            </header>

            {isShopProduct && hasProductFacts && <div className="product-facts" aria-label={language === "fr" ? "Informations produit" : "Product information"}>
              {product.origin && <div><span>{language === "fr" ? "Origine" : "Origin"}</span><strong>{product.origin}</strong></div>}
              {product.cultivar && <div><span>Cultivar</span><strong>{product.cultivar}</strong></div>}
              {product.ideal_for.length > 0 && <div className="product-fact-ideal"><span>{language === "fr" ? "Idéal pour" : "Ideal for"}</span><div>{product.ideal_for.map((item) => <em key={item}>{item}</em>)}</div></div>}
            </div>}

            <section className="product-buy-panel" aria-label={language === "fr" ? "Choix du produit" : "Product choices"}>
              {packageOptions.length > 1 && <div className="option-group variant-dimension compact-option-group">
                <span className="option-label">{language === "fr" ? "Conditionnement" : "Packaging"}</span>
                <div className="option-pills packaging-pills">{packageOptions.map((option) => <button
                  type="button"
                  key={option.key}
                  className={`${selectedPackaging === option.key ? "active " : ""}${!option.available ? "is-sold-out-option-v429" : ""}`.trim()}
                  onClick={() => onPackagingSelect(option.key)}
                  title={!option.available ? (language === "fr" ? "Sélectionner pour créer une alerte" : "Select to create a restock alert") : undefined}
                >
                  <span>{packagingLabel(option.packaging, language)}</span>
                  {!option.available && <small>{language === "fr" ? "Épuisé" : "Sold out"}</small>}
                </button>)}</div>
              </div>}

              {variantsForPackaging.length > 1 && <div className="option-group variant-dimension compact-option-group">
                <span className="option-label">{language === "fr" ? "Format" : "Size"}</span>
                <div className="option-pills format-pills-v28">{variantsForPackaging.map((item) => <button
                  type="button"
                  key={item.id}
                  className={`${variantId === item.id ? "active " : ""}${item.stock <= 0 ? "is-sold-out-option-v429" : ""}`.trim()}
                  onClick={() => onVariantSelect(item.id)}
                  title={item.stock <= 0 ? (language === "fr" ? "Sélectionner pour créer une alerte" : "Select to create a restock alert") : undefined}
                >
                  <span>{variantLabel(item)}</span>
                  {item.stock > 0 && <small>{money(item.price, language)}</small>}
                  {item.stock <= 0 && <b>{language === "fr" ? "Épuisé" : "Sold out"}</b>}
                </button>)}</div>
              </div>}

              {selectableVariants.length === 1 && variant && <div className="selected-variant-summary selected-variant-v28">
                <span>{packagingLabel(variant.packaging, language)}</span><strong>{variantLabel(variant)}</strong>
              </div>}

              {packageOptions.length > 1 && variantsForPackaging.length === 1 && variant && <div className="selected-variant-summary selected-variant-v28">
                <span>{language === "fr" ? "Format" : "Size"}</span><strong>{variantLabel(variant)}</strong>
              </div>}

              {showStock && <div className={`product-stock-detail product-stock-v28 ${currentStock <= 0 ? "sold" : currentStock <= 5 ? "low" : "available"}`}>
                <span className="stock-dot" aria-hidden="true"></span>
                <strong>{stockCopy(currentStock, language)}</strong>
                {variant && <small>{packagingLabel(variant.packaging, language)} · {variantLabel(variant)}</small>}
              </div>}

              {product.option_groups.map((group) => <div className="option-group compact-option-group" key={group.id}>
                <span className="option-label">{language === "fr" ? group.name_fr : group.name_en}{group.required ? " *" : ""}</span>
                <div className="option-pills">{group.values.map((value) => {
                  const active = selected[group.id]?.includes(value.id);
                  return <button type="button" key={value.id} className={active ? "active" : ""} onClick={() => onToggleOption(group.id, value.id, group.max_select)}>
                    {language === "fr" ? value.label_fr : value.label_en}{value.price_delta ? ` +${money(value.price_delta, language)}` : ""}
                  </button>;
                })}</div>
              </div>)}
            </section>

            {fullDescription && fullDescription !== shortDescription && <details className="product-about-details">
              <summary>{language === "fr" ? "En savoir plus sur ce produit" : "More about this product"}<span>+</span></summary>
              <p className="product-modal-description">{fullDescription}</p>
            </details>}
          </div>

          <div className={`modal-footer product-buy-footer ${cartQuantity > 0 ? "product-buy-footer-added" : ""}`}>
            {cartQuantity > 0 ? (
              <div className="product-cart-confirmation">
                <div className={`product-cart-success ${justAdded ? "is-new" : ""}`} role="status" aria-live="polite">
                  <span className="product-cart-success-icon" aria-hidden="true">✓</span>
                  <div>
                    <strong>{language === "fr" ? "Ajouté au panier" : "Added to cart"}</strong>
                    <small>
                      {language === "fr"
                        ? `${cartQuantity} × cette configuration · ${money(price * cartQuantity, language)}`
                        : `${cartQuantity} × this configuration · ${money(price * cartQuantity, language)}`}
                    </small>
                  </div>
                </div>

                <div className="product-cart-actions">
                  <div className="product-inline-qty" aria-label={language === "fr" ? "Quantité dans le panier" : "Quantity in cart"}>
                    <button type="button" onClick={onDecreaseQuantity} aria-label={language === "fr" ? "Diminuer la quantité" : "Decrease quantity"}>−</button>
                    <strong>{cartQuantity}</strong>
                    <button
                      type="button"
                      onClick={onIncreaseQuantity}
                      disabled={showStock && quantityInCartForStock >= currentStock}
                      aria-label={language === "fr" ? "Augmenter la quantité" : "Increase quantity"}
                    >+</button>
                  </div>

                  <Link className="button primary product-view-cart" href="/panier" onClick={onClose}>
                    <span>{language === "fr" ? "Voir le panier" : "View cart"}</span>
                    <b>{count}</b>
                  </Link>
                </div>

                <button type="button" className="product-continue-button" onClick={onClose}>
                  {language === "fr" ? "Continuer mes achats" : "Continue shopping"}
                </button>
              </div>
            ) : !hasStock ? (
              <RestockNotify
                productId={product.id}
                productName={name}
                variantId={variant?.id}
                variantName={variant ? productVariantLabel(variant, language) : undefined}
                language={language}
                context="modal"
              />
            ) : (
              <>
                <div className="product-price-block">
                  <span>{language === "fr" ? "Prix" : "Price"}</span>
                  <strong>{money(price, language)}</strong>
                </div>
                <button
                  type="button"
                  className="button primary product-buy-button"
                  disabled={!canAdd}
                  onClick={onAdd}
                >
                  {stockLimitReached
                    ? language === "fr"
                      ? "Quantité maximale atteinte"
                      : "Maximum quantity reached"
                    : language === "fr"
                      ? `Ajouter au panier · ${money(price, language)}`
                      : `Add to cart · ${money(price, language)}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
