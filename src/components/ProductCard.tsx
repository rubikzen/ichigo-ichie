"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { SafeImage } from "./SafeImage";
import { useCallback, useMemo, useRef, useState } from "react";
import type { CartChoice, Product, Variant } from "@/lib/types";
import { composeProductVariantName, packagingLabel, productVariantLabel, variantLabel } from "@/lib/product-label";
import { sanitizeStorefrontProductText } from "@/lib/product-content";
import { useLanguage } from "./LanguageProvider";
import { useCart } from "./CartProvider";
import { RestockNotify } from "./RestockNotify";
import { trackConversion } from "@/lib/conversion-analytics";
import { matchaFinderLabel, productMatchaFinderTags } from "@/lib/product-merchandising";
import { useProductReviewSummary } from "./ReviewSummaryProvider";
import { productPublicPath } from "@/lib/product-url";

const ProductModal = dynamic(
  () => import("./ProductModal").then((module) => module.ProductModal),
  { ssr: false },
);

const moneyFormatters = {
  fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }),
} as const;

const money = (value: number, language: "fr" | "en") =>
  moneyFormatters[language].format(value);

type PackagingKey = "can" | "bag" | "other";

const packagingKey = (variant: Variant): PackagingKey => {
  if (variant.packaging === "can" || variant.packaging === "bag") return variant.packaging;
  return "other";
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
  const reviewSummary = useProductReviewSummary(product.id);
  const selectableVariants = useMemo(() => product.variants.filter((item) => item.active), [product.variants]);
  const firstAvailable = selectableVariants.find((item) => item.stock > 0) ?? selectableVariants[0] ?? null;
  const gallery = useMemo(() => {
    const rows = [...(product.images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    if (rows.length) return rows.map((item) => item.url);
    return [product.image_url || "/product-placeholder.svg"];
  }, [product.images, product.image_url]);

  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "");
  const [selectedPackaging, setSelectedPackaging] = useState<PackagingKey>(firstAvailable ? packagingKey(firstAvailable) : "other");
  const [imageIndex, setImageIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(product.option_groups.map((group) => {
    const minimum = group.required ? Math.max(1, group.min_select) : Math.max(0, group.min_select);
    return [group.id, group.values.slice(0, minimum).map((value) => value.id)];
  })));
  const [justAdded, setJustAdded] = useState(false);

  const closeProductDetails = useCallback(() => setOpen(false), []);
  const openProductDetails = (opener: HTMLElement) => {
    openerRef.current = opener;
    trackConversion(
      "product_view",
      {
        product_id: product.id,
        value: product.base_price,
        currency: "EUR",
        source: "product_modal",
      },
      { dedupeKey: `product_view:modal:${product.id}` },
    );
    setOpen(true);
  };

  const name = language === "fr" ? product.name_fr : product.name_en;
  const shortDescription = sanitizeStorefrontProductText(
    (language === "fr" ? product.description_fr : product.description_en) ||
      product.description_fr ||
      "",
  );
  const fullDescription =
    sanitizeStorefrontProductText(
      language === "fr" ? product.long_description_fr : product.long_description_en,
    ) || shortDescription;
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
    addItem({
      key: cartKey,
      productId: product.id,
      variantId: variant?.id,
      name: composeProductVariantName(name, variant, language),
      imageUrl: coverImage,
      unitPrice: price,
      pickupOnly: product.pickup_only,
      choices,
    });
    trackConversion("add_to_cart", {
      product_id: product.id,
      variant_id: variant?.id,
      value: price,
      quantity: 1,
      item_count: 1,
      currency: "EUR",
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

  const merchandisingTags = productMatchaFinderTags(product);
  const isSoldOut = totalStock <= 0;
  const availableVariants = selectableVariants.filter((item) => item.stock > 0);
  const minimumPrice = availableVariants.length ? Math.min(...availableVariants.map((item) => item.price)) : product.base_price;
  const formatLabels = [...new Set(selectableVariants.map((item) => variantLabel(item)))];
  const packagingLabels = packageOptions.map((option) => packagingLabel(option.packaging, language));
  const singleVariantLabels = selectableVariants.length === 1
    ? productVariantLabel(selectableVariants[0], language)
        .split("·")
        .map((label) => label.trim())
        .filter((label) => label && label !== "Format")
    : [];
  const requiresChoice = selectableVariants.length > 1;

  return <>
    <article className="product-card product-card-compact">
      <button className="product-image-button" onClick={(event) => openProductDetails(event.currentTarget)} aria-label={name}>
        <SafeImage
          className="product-image"
          src={coverImage}
          alt={name}
          width={800}
          height={656}
          sizes="(max-width: 720px) calc(100vw - 24px), (max-width: 1100px) 50vw, 33vw"
          loading="lazy"
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
              onClick={(event) => openProductDetails(event.currentTarget)}
              aria-label={language === "fr" ? `Voir les détails de ${name}` : `View details for ${name}`}
            >
              {name}
            </button>
            <Link
              className="product-title-link-v4792"
              href={productPublicPath(product)}
              aria-label={language === "fr" ? `Voir ${name}` : `View ${name}`}
            >
              {name}
            </Link>
          </h3>
          {!isSoldOut && <strong className="product-card-price">{selectableVariants.length > 1 && (language === "fr" ? "Dès " : "From ")}{money(minimumPrice, language)}</strong>}
        </div>

        {reviewSummary && reviewSummary.count > 0 && (
          <Link
            className="product-card-rating-v4661"
            href={`/boutique/${encodeURIComponent(product.slug.trim().toLowerCase())}#avis`}
          >
            <span aria-hidden="true">★</span>
            <strong>{reviewSummary.average.toFixed(1).replace(".", language === "fr" ? "," : ".")}</strong>
            <small>· {reviewSummary.count} {language === "fr" ? "avis" : reviewSummary.count === 1 ? "review" : "reviews"}</small>
          </Link>
        )}

        {shortDescription && <p className="product-card-description" title={shortDescription}>{shortDescription}</p>}

        <Link
          className="product-permalink-v431"
          href={productPublicPath(product)}
        >
          <span>{language === "fr" ? "Voir la page produit" : "View product page"}</span>
          <span aria-hidden="true">→</span>
        </Link>

        {merchandisingTags.length > 0 && (
          <div className="product-merchandising-v462" aria-label={language === "fr" ? "Idéal pour" : "Best for"}>
            <small>{language === "fr" ? "Idéal pour" : "Best for"}</small>
            {merchandisingTags.slice(0, 3).map((tag) => (
              <span key={tag}>{matchaFinderLabel(tag, language)}</span>
            ))}
          </div>
        )}

        <div className="product-card-meta">
          {packagingLabels.length > 1 && <div className="product-card-chips" aria-label={language === "fr" ? "Conditionnements disponibles" : "Available packaging"}>
            {packagingLabels.map((label) => <span key={label}>{label}</span>)}
          </div>}
          {packagingLabels.length <= 1 && formatLabels.length > 1 && <div className="product-card-chips" aria-label={language === "fr" ? "Formats disponibles" : "Available sizes"}>
            {formatLabels.slice(0, 3).map((label) => <span key={label}>{label}</span>)}
            {formatLabels.length > 3 && <span>+{formatLabels.length - 3}</span>}
          </div>}
          {singleVariantLabels.length > 0 && <div className="product-card-chips product-card-single-variant-v4804" aria-label={language === "fr" ? "Format du produit" : "Product format"}>
            {singleVariantLabels.map((label) => <span key={label}>{label}</span>)}
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

        {isSoldOut ? (
          <RestockNotify
            productId={product.id}
            productName={name}
            language={language}
            context="card"
          />
        ) : (
          <button
            type="button"
            className={`button full product-card-cta primary ${
              !requiresChoice && justAdded ? "is-added-v381" : ""
            }`}
            disabled={!requiresChoice && stockLimitReached}
            aria-live="polite"
            onClick={(event) => {
              if (!requiresChoice && stockLimitReached) return;

              if (requiresChoice) {
                openProductDetails(event.currentTarget);
                return;
              }

              handleAdd();
            }}
          >
            {!requiresChoice && justAdded
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
        )}
      </div>
    </article>

    {open && (
      <ProductModal
        product={product}
        language={language}
        name={name}
        shortDescription={shortDescription}
        fullDescription={fullDescription}
        gallery={gallery}
        imageIndex={imageIndex}
        setImageIndex={setImageIndex}
        opener={openerRef.current}
        onClose={closeProductDetails}
        packageOptions={packageOptions}
        selectedPackaging={selectedPackaging}
        onPackagingSelect={selectPackaging}
        variantsForPackaging={variantsForPackaging}
        variantId={variantId}
        onVariantSelect={setVariantId}
        selectableVariants={selectableVariants}
        variant={variant}
        showStock={showStock}
        currentStock={currentStock}
        selected={selected}
        onToggleOption={toggleOption}
        cartQuantity={cartQuantity}
        justAdded={justAdded}
        price={price}
        onDecreaseCartQuantity={decreaseCartQuantity}
        onIncreaseCartQuantity={increaseCartQuantity}
        quantityInCartForStock={quantityInCartForStock}
        count={count}
        hasStock={hasStock}
        canAdd={canAdd}
        stockLimitReached={stockLimitReached}
        onAdd={handleAdd}
      />
    )}
  </>;
}
