"use client";

import Link from "next/link";
import { SafeImage } from "./SafeImage";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { CartChoice, Product, Variant } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useCart } from "./CartProvider";

const money = (value: number, language: "fr" | "en") => new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: "EUR" }).format(value);

type PackagingKey = "can" | "bag" | "other";

const packagingKey = (variant: Variant): PackagingKey => {
  if (variant.packaging === "can" || variant.packaging === "bag") return variant.packaging;
  return "other";
};
const packagingLabel = (packaging: Variant["packaging"], language: "fr" | "en") => {
  if (packaging === "can") return language === "fr" ? "Boîte" : "Tin";
  if (packaging === "bag") return language === "fr" ? "Sachet" : "Pouch";
  return language === "fr" ? "Autre" : "Other";
};

const normalized = (value?: string | null) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const variantLabel = (variant: Variant) => {
  const weight = String(variant.weight ?? "").trim();
  const name = String(variant.name ?? "").trim();
  if (weight && name && normalized(weight) !== normalized(name)) return `${name} · ${weight}`;
  return weight || name || "Format";
};

function stockCopy(stock: number, language: "fr" | "en") {
  if (stock <= 0) return language === "fr" ? "Rupture de stock" : "Sold out";
  if (stock <= 5) return language === "fr" ? `Plus que ${stock} en stock` : `Only ${stock} left`;
  return language === "fr" ? `${stock} en stock` : `${stock} in stock`;
}

function productCardStateKey(product: Product) {
  return `${product.id}:${JSON.stringify(product.option_groups)}`;
}

export function ProductCard({ product }: { product: Product }) {
  return <ProductCardStateful key={productCardStateKey(product)} product={product} />;
}

function ProductCardStateful({ product }: { product: Product }) {
  const { language } = useLanguage();
  const { items, count, addItem, setQuantity, removeItem } = useCart();
  const selectableVariants = useMemo(() => product.variants.filter((item) => item.active), [product.variants]);
  const firstAvailable = selectableVariants.find((item) => item.stock > 0) ?? selectableVariants[0] ?? null;
  const gallery = useMemo(() => {
    const rows = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    if (rows.length) return rows.map((item) => item.url);
    return [product.image_url || "/product-placeholder.svg"];
  }, [product.images, product.image_url]);

  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingKey>(firstAvailable ? packagingKey(firstAvailable) : "other");
  const [imageIndex, setImageIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(product.option_groups.map((group) => {
    const minimum = group.required ? Math.max(1, group.min_select) : Math.max(0, group.min_select);
    return [group.id, group.values.slice(0, minimum).map((value) => value.id)];
  })));
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowLeft" && gallery.length > 1) setImageIndex((current) => (current - 1 + gallery.length) % gallery.length);
      if (event.key === "ArrowRight" && gallery.length > 1) setImageIndex((current) => (current + 1) % gallery.length);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, gallery.length]);

  const name = language === "fr" ? product.name_fr : product.name_en;
  const shortDescription = (language === "fr" ? product.description_fr : product.description_en) || product.description_fr || "";
  const fullDescription = (language === "fr" ? product.long_description_fr : product.long_description_en) || shortDescription;
  const variant = selectableVariants.find((item) => item.id === variantId) ?? firstAvailable;

  const packageOptions = useMemo(() => {
    const seen = new Set<PackagingKey>();
    return selectableVariants.reduce<Array<{ key: PackagingKey; packaging: Variant["packaging"]; available: boolean }>>((rows, item) => {
      const key = packagingKey(item);
      if (seen.has(key)) return rows;
      seen.add(key);
      rows.push({ key, packaging: item.packaging, available: selectableVariants.some((candidate) => packagingKey(candidate) === key && candidate.stock > 0) });
      return rows;
    }, []);
  }, [selectableVariants]);

  const variantsForPackaging = useMemo(() => selectableVariants.filter((item) => packagingKey(item) === selectedPackaging), [selectableVariants, selectedPackaging]);

  const choices: CartChoice[] = useMemo(() => product.option_groups.flatMap((group) => {
    const valueIds = selected[group.id] ?? [];
    return group.values.filter((value) => valueIds.includes(value.id)).map((value) => ({
      groupId: group.id,
      groupName: language === "fr" ? group.name_fr : group.name_en,
      valueId: value.id,
      valueName: language === "fr" ? value.label_fr : value.label_en,
      priceDelta: value.price_delta,
    }));
  }), [product.option_groups, selected, language]);

  const cartKey = useMemo(
    () => [product.id, variant?.id ?? "base", ...choices.map((choice) => `${choice.groupId}:${choice.valueId}`).sort()].join("|"),
    [product.id, variant?.id, choices],
  );
  const cartItem = items.find((item) => item.key === cartKey);
  const cartQuantity = cartItem?.quantity ?? 0;

  const price = (variant?.price ?? product.base_price) + choices.reduce((sum, choice) => sum + choice.priceDelta, 0);
  const coverImage = gallery[0] || "/product-placeholder.svg";
  const image = gallery[Math.min(imageIndex, gallery.length - 1)] || coverImage;
  const currentStock = variant ? Number(variant.stock) : Number(product.stock);
  const totalStock = selectableVariants.length ? selectableVariants.reduce((sum, item) => sum + Math.max(0, Number(item.stock)), 0) : Number(product.stock);
  const hasStock = currentStock > 0;
  const showStock = product.type === "product" || product.type === "accessory";
  const quantityInCartForStock = showStock
    ? items.reduce((sum, item) => {
        if (item.productId !== product.id) return sum;
        if (variant?.id) return item.variantId === variant.id ? sum + item.quantity : sum;
        return item.variantId ? sum : sum + item.quantity;
      }, 0)
    : 0;
  const stockLimitReached = showStock && quantityInCartForStock >= currentStock;

  const canAdd = hasStock && !stockLimitReached && product.option_groups.every((group) => {
    const count = selected[group.id]?.length ?? 0;
    const minimum = group.required ? Math.max(1, group.min_select) : Math.max(0, group.min_select);
    return count >= minimum && count <= group.max_select;
  });

  const toggleOption = (groupId: string, valueId: string, max: number) => {
    setSelected((current) => {
      const values = current[groupId] ?? [];
      if (max === 1) return { ...current, [groupId]: [valueId] };
      if (values.includes(valueId)) return { ...current, [groupId]: values.filter((id) => id !== valueId) };
      if (values.length >= max) return current;
      return { ...current, [groupId]: [...values, valueId] };
    });
  };

  const selectPackaging = (key: PackagingKey) => {
    setSelectedPackaging(key);
    const next = selectableVariants.find((item) => packagingKey(item) === key && item.weight === variant?.weight && item.stock > 0)
      ?? selectableVariants.find((item) => packagingKey(item) === key && item.stock > 0)
      ?? selectableVariants.find((item) => packagingKey(item) === key);
    if (next) setVariantId(next.id);
  };

  const handleAdd = () => {
    if (!canAdd) return;
    const variantDescription = variant ? `${packagingLabel(variant.packaging, language)} · ${variantLabel(variant)}` : "";
    addItem({
      key: cartKey,
      productId: product.id,
      variantId: variant?.id,
      name: `${name}${variantDescription ? ` · ${variantDescription}` : ""}`,
      imageUrl: coverImage,
      unitPrice: price,
      pickupOnly: product.pickup_only,
      choices,
    });
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1200);
  };

  const decreaseCartQuantity = () => {
    if (!cartItem) return;
    if (cartItem.quantity <= 1) removeItem(cartKey);
    else setQuantity(cartKey, cartItem.quantity - 1);
  };

  const increaseCartQuantity = () => {
    if (showStock && quantityInCartForStock >= currentStock) return;
    if (cartItem) setQuantity(cartKey, cartItem.quantity + 1);
    else handleAdd();
  };

  const isShopProduct = product.type === "product" || product.type === "accessory";
  const hasProductFacts = Boolean(product.origin || product.cultivar || product.ideal_for.length);

  const modal = open && mounted ? createPortal(
    <div className="modal-backdrop product-detail-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
      <div className="product-modal product-modal-v28" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={name}>
        <button className="modal-close" onClick={() => setOpen(false)} aria-label={language === "fr" ? "Fermer" : "Close"}>×</button>

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
                <div className="option-pills packaging-pills">{packageOptions.map((option) => <button type="button" key={option.key} className={selectedPackaging === option.key ? "active" : ""} onClick={() => selectPackaging(option.key)} disabled={!option.available}>{packagingLabel(option.packaging, language)}</button>)}</div>
              </div>}

              {variantsForPackaging.length > 1 && <div className="option-group variant-dimension compact-option-group">
                <span className="option-label">{language === "fr" ? "Format" : "Size"}</span>
                <div className="option-pills format-pills-v28">{variantsForPackaging.map((item) => <button type="button" key={item.id} className={variantId === item.id ? "active" : ""} onClick={() => setVariantId(item.id)} disabled={item.stock <= 0}><span>{variantLabel(item)}</span><small>{money(item.price, language)}</small>{item.stock <= 0 && <b>{language === "fr" ? "Épuisé" : "Sold out"}</b>}</button>)}</div>
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
                  return <button type="button" key={value.id} className={active ? "active" : ""} onClick={() => toggleOption(group.id, value.id, group.max_select)}>
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
                    <button type="button" onClick={decreaseCartQuantity} aria-label={language === "fr" ? "Diminuer la quantité" : "Decrease quantity"}>−</button>
                    <strong>{cartQuantity}</strong>
                    <button
                      type="button"
                      onClick={increaseCartQuantity}
                      disabled={showStock && quantityInCartForStock >= currentStock}
                      aria-label={language === "fr" ? "Augmenter la quantité" : "Increase quantity"}
                    >+</button>
                  </div>

                  <Link className="button primary product-view-cart" href="/panier" onClick={() => setOpen(false)}>
                    <span>{language === "fr" ? "Voir le panier" : "View cart"}</span>
                    <b>{count}</b>
                  </Link>
                </div>

                <button type="button" className="product-continue-button" onClick={() => setOpen(false)}>
                  {language === "fr" ? "Continuer mes achats" : "Continue shopping"}
                </button>
              </div>
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
  onClick={handleAdd}
>
  {!hasStock
    ? language === "fr"
      ? "Indisponible"
      : "Unavailable"
    : stockLimitReached
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
  ) : null;

  const minimumPrice = selectableVariants.length ? Math.min(...selectableVariants.map((item) => item.price)) : product.base_price;
  const formatLabels = [...new Set(selectableVariants.map((item) => variantLabel(item)))];
  const packagingLabels = packageOptions.map((option) => packagingLabel(option.packaging, language));
  const isSoldOut = totalStock <= 0;
const requiresChoice = selectableVariants.length > 1;

  return <>
    <article className="product-card product-card-compact">
      <button className="product-image-button" onClick={() => setOpen(true)} aria-label={name}>
        <SafeImage
          className="product-image"
          src={coverImage}
          alt={name}
          width={800}
          height={656}
          sizes="(max-width: 720px) calc(100vw - 24px), (max-width: 1100px) 50vw, 33vw"
        />
        {product.badge && <span className="badge">{product.badge}</span>}
        {gallery.length > 1 && <span className="photo-count">{gallery.length} photos</span>}
      </button>
      <div className="product-copy">
        <div className="product-title-row">
          <h3 title={name}>
            <button
              type="button"
              className="product-title-button-v415"
              onClick={() => setOpen(true)}
              aria-label={language === "fr" ? `Voir les détails de ${name}` : `View details for ${name}`}
            >
              {name}
            </button>
          </h3>
          <strong className="product-card-price">{selectableVariants.length > 1 && (language === "fr" ? "Dès " : "From ")}{money(minimumPrice, language)}</strong>
        </div>

        {shortDescription && <p className="product-card-description" title={shortDescription}>{shortDescription}</p>}

        <div className="product-card-meta">
          {packagingLabels.length > 1 && <div className="product-card-chips" aria-label={language === "fr" ? "Conditionnements disponibles" : "Available packaging"}>
            {packagingLabels.map((label) => <span key={label}>{label}</span>)}
          </div>}
          {packagingLabels.length <= 1 && formatLabels.length > 1 && <div className="product-card-chips" aria-label={language === "fr" ? "Formats disponibles" : "Available sizes"}>
            {formatLabels.slice(0, 3).map((label) => <span key={label}>{label}</span>)}
            {formatLabels.length > 3 && <span>+{formatLabels.length - 3}</span>}
          </div>}
          {showStock && <p className={`product-stock-card ${totalStock <= 0 ? "sold" : totalStock <= 5 ? "low" : "available"}`}><span className="stock-dot" aria-hidden="true"></span>{stockCopy(totalStock, language)}</p>}
          {showStock && !requiresChoice && hasStock && quantityInCartForStock > 0 && (
            <p className={`product-cart-stock-note ${stockLimitReached ? "is-max" : ""}`} aria-live="polite">
              {language === "fr"
                ? `Dans votre panier : ${quantityInCartForStock} / ${currentStock}`
                : `In your cart: ${quantityInCartForStock} / ${currentStock}`}
            </p>
          )}
        </div>

        <button
  type="button"
  className={`button full product-card-cta ${
    isSoldOut ? "product-card-cta-soldout" : "primary"
  } ${!requiresChoice && justAdded ? "is-added-v381" : ""}`}
  disabled={isSoldOut || (!requiresChoice && stockLimitReached)}
  aria-live="polite"
  onClick={() => {
    if (isSoldOut || (!requiresChoice && stockLimitReached)) return;

    if (requiresChoice) {
      setOpen(true);
      return;
    }

    handleAdd();
  }}
>
  {isSoldOut
    ? language === "fr"
      ? "Indisponible"
      : "Unavailable"
    : !requiresChoice && justAdded
      ? language === "fr"
        ? "✓ Ajouté au panier"
        : "✓ Added to cart"
    : !requiresChoice && stockLimitReached
      ? language === "fr"
        ? "Quantité maximale atteinte"
        : "Maximum quantity reached"
    : requiresChoice
      ? language === "fr"
        ? "Choisir"
        : "Choose"
      : language === "fr"
        ? `Ajouter · ${money(minimumPrice, language)}`
        : `Add · ${money(minimumPrice, language)}`}
</button>
      </div>
    </article>
    {modal}
  </>;
}
