"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/components/CartProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import type { CartChoice, CartItem, Product, Variant } from "@/lib/types";

const money = (value: number, language: "fr" | "en") => new Intl.NumberFormat(
  language === "fr" ? "fr-FR" : "en-GB",
  { style: "currency", currency: "EUR" },
).format(value);

const packagingKey = (variant: Variant) => variant.packaging ?? "other";
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

function getItemStock(item: CartItem, product?: Product) {
  if (!product || (product.type !== "product" && product.type !== "accessory")) return null;
  if (item.variantId) {
    const variant = product.variants.find((row) => row.id === item.variantId);
    return variant ? Number(variant.stock) : 0;
  }
  return Number(product.stock);
}

export function CartPageClient({ products }: { products: Product[] }) {
  const { items, count, subtotal, setQuantity, removeItem, replaceItem, clear } = useCart();
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const cms = (fr: string, en: string, fallbackFr: string, fallbackEn: string) => settings[language === "fr" ? fr : en] || (language === "fr" ? fallbackFr : fallbackEn);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  // V2.27: clean legacy Menu items that may still be stored in localStorage from
  // older versions where drinks/desserts could be ordered online.
  useEffect(() => {
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (product && product.type !== "product" && product.type !== "accessory") removeItem(item.key);
    }
  }, [items, productMap, removeItem]);

  const editingItem = items.find((item) => item.key === editingKey) ?? null;
  const editingProduct = editingItem ? productMap.get(editingItem.productId) : undefined;
  const hasPickupOnly = items.some((item) => item.pickupOnly);
  const hasShippingItems = items.some((item) => !item.pickupOnly);

  const updateQuantity = (item: CartItem, next: number) => {
    if (next <= 0) {
      removeItem(item.key);
      return;
    }
    const stock = getItemStock(item, productMap.get(item.productId));
    if (stock !== null && next > stock) return;
    setQuantity(item.key, next);
  };

  const closeEditor = () => setEditingKey(null);

  return <section className="cart-page cart-page-v216">
    <div className="cart-page-head-v216">
      <div className="page-heading cart-heading-v216">
        <p className="eyebrow">{cms("cart_eyebrow_fr", "cart_eyebrow_en", "ICHIGO ICHIE", "ICHIGO ICHIE")}</p>
        <h1>{cms("cart_title_fr", "cart_title_en", "Votre panier", "Your cart")}</h1>
        <p>{language === "fr" ? `${count} article${count > 1 ? "s" : ""}` : `${count} item${count === 1 ? "" : "s"}`}</p>
      </div>
      {items.length > 0 && <button className="cart-clear-v216" type="button" onClick={() => {
        if (window.confirm(language === "fr" ? "Vider tout le panier ?" : "Empty the whole cart?")) clear();
      }}>{language === "fr" ? "Vider le panier" : "Clear cart"}</button>}
    </div>

    {!items.length ? <div className="empty-state cart-empty-v216">
      <h2>{cms("cart_empty_title_fr", "cart_empty_title_en", "Votre panier est vide", "Your cart is empty")}</h2>
      <p>{cms("cart_empty_text_fr", "cart_empty_text_en", "Ajoutez un matcha, un accessoire ou un coffret depuis la Boutique.", "Add matcha, accessories or a gift set from the Shop.")}</p>
      <div className="cart-empty-actions-v216">
        <Link className="button primary" href="/#boutique">{language === "fr" ? "Voir la boutique" : "View shop"}</Link>
      </div>
    </div> : <div className="cart-layout cart-layout-v216">
      <div className="cart-main-v216">
        <div className="cart-items cart-items-v216">
          {items.map((item) => {
            const product = productMap.get(item.productId);
            const stock = getItemStock(item, product);
            const canEdit = Boolean(product && (product.variants.length > 0 || product.option_groups.length > 0));
            return <article className={`cart-item cart-item-v216 ${savedKey === item.key ? "is-updated" : ""}`} key={item.key}>
              <img className="cart-item-image-v216" src={item.imageUrl || product?.image_url || "/product-placeholder.svg"} alt="" />
              <div className="cart-item-body-v216">
                <div className="cart-item-title-v216">
                  <div>
                    <h3>{item.name}</h3>
                    <span className={`cart-method-chip-v216 ${item.pickupOnly ? "pickup" : "shipping"}`}>
                      {item.pickupOnly
                        ? (language === "fr" ? "Retrait boutique" : "Boutique pickup")
                        : (language === "fr" ? "Livraison possible" : "Shipping available")}
                    </span>
                  </div>
                  <strong>{money(item.unitPrice * item.quantity, language)}</strong>
                </div>

                {item.choices.length > 0 && <div className="cart-choice-chips-v216">
                  {item.choices.map((choice) => <span key={`${choice.groupId}-${choice.valueId}`}>
                    <small>{choice.groupName}</small>{choice.valueName}{choice.priceDelta > 0 ? ` +${money(choice.priceDelta, language)}` : ""}
                  </span>)}
                </div>}

                <div className="cart-item-controls-v216">
                  <div className="qty qty-v216" aria-label={language === "fr" ? "Quantité" : "Quantity"}>
                    <button type="button" onClick={() => updateQuantity(item, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => updateQuantity(item, item.quantity + 1)} disabled={stock !== null && item.quantity >= stock}>+</button>
                  </div>
                  {stock !== null && <small className="cart-stock-v216">{language === "fr" ? `${stock} en stock` : `${stock} in stock`}</small>}
                  <div className="cart-line-actions-v216">
                    {canEdit && <button type="button" onClick={() => setEditingKey(item.key)}>{language === "fr" ? "Modifier" : "Edit"}</button>}
                    <button type="button" className="danger" onClick={() => removeItem(item.key)}>{language === "fr" ? "Supprimer" : "Remove"}</button>
                  </div>
                </div>
              </div>
            </article>;
          })}
        </div>

        <div className="cart-continue-v216">
          <Link href="/#boutique">← {language === "fr" ? "Continuer dans la boutique" : "Continue in shop"}</Link>
        </div>
      </div>

      <aside className="cart-summary cart-summary-v216">
        <p className="eyebrow">{language === "fr" ? "RÉCAPITULATIF" : "SUMMARY"}</p>
        <h2>{language === "fr" ? "Votre commande" : "Your order"}</h2>
        <div className="cart-summary-line-v216"><span>{language === "fr" ? "Articles" : "Items"}</span><strong>{count}</strong></div>
        <div className="cart-summary-line-v216 cart-summary-total-v216"><span>{language === "fr" ? "Sous-total" : "Subtotal"}</span><strong>{money(subtotal, language)}</strong></div>

        <div className="cart-fulfilment-v216">
          {hasPickupOnly && <p><b>●</b>{language === "fr" ? " Cette commande contient un article à retirer en boutique." : " This order contains an item requiring boutique pickup."}</p>}
          {!hasPickupOnly && hasShippingItems && <p><b>●</b>{language === "fr" ? " Livraison ou retrait à choisir à l’étape suivante." : " Choose shipping or pickup at the next step."}</p>}
        </div>

        <Link className="button primary full cart-checkout-v216" href="/checkout">
          <span>{language === "fr" ? "Passer à la commande" : "Proceed to checkout"}</span>
          <strong>{money(subtotal, language)}</strong>
        </Link>
        <small className="cart-summary-note-v216">{language === "fr" ? "Les frais de livraison seront calculés au checkout." : "Shipping costs are calculated at checkout."}</small>
      </aside>
    </div>}

    {editingItem && editingProduct && <CartItemEditor
      item={editingItem}
      product={editingProduct}
      allItems={items}
      language={language}
      onClose={closeEditor}
      onSave={(next) => {
        replaceItem(editingItem.key, next);
        setSavedKey(next.key);
        setEditingKey(null);
        window.setTimeout(() => setSavedKey(null), 1400);
      }}
    />}
  </section>;
}

function CartItemEditor({ item, product, allItems, language, onClose, onSave }: {
  item: CartItem;
  product: Product;
  allItems: CartItem[];
  language: "fr" | "en";
  onClose: () => void;
  onSave: (item: CartItem) => void;
}) {
  const selectableVariants = product.variants.filter((variant) => variant.active);
  const initialVariant = selectableVariants.find((variant) => variant.id === item.variantId) ?? selectableVariants[0] ?? null;
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
  const [packaging, setPackaging] = useState(initialVariant ? packagingKey(initialVariant) : "other");
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const grouped: Record<string, string[]> = {};
    for (const group of product.option_groups) {
      const previous = item.choices.filter((choice) => choice.groupId === group.id).map((choice) => choice.valueId);
      if (previous.length) grouped[group.id] = previous;
      else {
        const minimum = group.required ? Math.max(1, group.min_select) : Math.max(0, group.min_select);
        grouped[group.id] = group.values.slice(0, minimum).map((value) => value.id);
      }
    }
    return grouped;
  });

  const variant = selectableVariants.find((row) => row.id === variantId) ?? initialVariant;
  const packageOptions = [...new Map(selectableVariants.map((row) => [packagingKey(row), row.packaging])).entries()];
  const variantsForPackaging = selectableVariants.filter((row) => packagingKey(row) === packaging);

  const choices: CartChoice[] = product.option_groups.flatMap((group) => {
    const selectedIds = selected[group.id] ?? [];
    return group.values.filter((value) => selectedIds.includes(value.id)).map((value) => ({
      groupId: group.id,
      groupName: language === "fr" ? group.name_fr : group.name_en,
      valueId: value.id,
      valueName: language === "fr" ? value.label_fr : value.label_en,
      priceDelta: Number(value.price_delta),
    }));
  });

  const nextKey = [product.id, variant?.id ?? "base", ...choices.map((choice) => `${choice.groupId}:${choice.valueId}`).sort()].join("|");
  const nextUnitPrice = Number(variant?.price ?? product.base_price) + choices.reduce((sum, choice) => sum + choice.priceDelta, 0);
  const maxStock = (product.type === "product" || product.type === "accessory") ? Number(variant?.stock ?? product.stock) : null;
  const existingTarget = allItems.find((row) => row.key === nextKey && row.key !== item.key);
  const mergedQuantity = item.quantity + (existingTarget?.quantity ?? 0);
  const stockConflict = maxStock !== null && mergedQuantity > maxStock;
  const requirementsOk = product.option_groups.every((group) => {
    const count = selected[group.id]?.length ?? 0;
    const minimum = group.required ? Math.max(1, group.min_select) : Math.max(0, group.min_select);
    return count >= minimum && count <= group.max_select;
  });
  const canSave = requirementsOk && !stockConflict && (maxStock === null || maxStock > 0);

  const selectPackaging = (key: string) => {
    setPackaging(key);
    const next = selectableVariants.find((row) => packagingKey(row) === key && row.weight === variant?.weight && row.stock > 0)
      ?? selectableVariants.find((row) => packagingKey(row) === key && row.stock > 0)
      ?? selectableVariants.find((row) => packagingKey(row) === key);
    if (next) setVariantId(next.id);
  };

  const toggleOption = (groupId: string, valueId: string, max: number) => {
    setSelected((current) => {
      const values = current[groupId] ?? [];
      if (max === 1) return { ...current, [groupId]: [valueId] };
      if (values.includes(valueId)) return { ...current, [groupId]: values.filter((id) => id !== valueId) };
      if (values.length >= max) return current;
      return { ...current, [groupId]: [...values, valueId] };
    });
  };

  const save = () => {
    if (!canSave) return;
    const baseName = language === "fr" ? product.name_fr : product.name_en;
    const variantDescription = variant ? `${packagingLabel(variant.packaging, language)} · ${variantLabel(variant)}` : "";
    onSave({
      ...item,
      key: nextKey,
      variantId: variant?.id ?? null,
      name: `${baseName}${variantDescription ? ` · ${variantDescription}` : ""}`,
      imageUrl: product.images?.[0]?.url || product.image_url || item.imageUrl,
      unitPrice: nextUnitPrice,
      pickupOnly: product.pickup_only,
      choices,
    });
  };

  return createPortal(<div className="cart-editor-backdrop-v216" onMouseDown={onClose}>
    <div className="cart-editor-v216" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <div className="cart-editor-head-v216">
        <div><p className="eyebrow">{language === "fr" ? "MODIFIER" : "EDIT"}</p><h2>{language === "fr" ? product.name_fr : product.name_en}</h2></div>
        <button type="button" onClick={onClose} aria-label={language === "fr" ? "Fermer" : "Close"}>×</button>
      </div>

      <div className="cart-editor-body-v216">
        {packageOptions.length > 1 && <div className="cart-editor-group-v216">
          <span>{language === "fr" ? "Conditionnement" : "Packaging"}</span>
          <div>{packageOptions.map(([key, value]) => <button type="button" key={key} className={packaging === key ? "active" : ""} onClick={() => selectPackaging(key)}>{packagingLabel(value, language)}</button>)}</div>
        </div>}

        {variantsForPackaging.length > 1 && <div className="cart-editor-group-v216">
          <span>{language === "fr" ? "Format" : "Size"}</span>
          <div>{variantsForPackaging.map((row) => <button type="button" key={row.id} disabled={row.stock <= 0} className={variantId === row.id ? "active" : ""} onClick={() => setVariantId(row.id)}>{variantLabel(row)} · {money(row.price, language)}</button>)}</div>
        </div>}

        {product.option_groups.map((group) => <div className="cart-editor-group-v216" key={group.id}>
          <span>{language === "fr" ? group.name_fr : group.name_en}{group.required ? " *" : ""}</span>
          <div>{group.values.map((value) => {
            const active = selected[group.id]?.includes(value.id);
            return <button type="button" key={value.id} className={active ? "active" : ""} onClick={() => toggleOption(group.id, value.id, group.max_select)}>
              {language === "fr" ? value.label_fr : value.label_en}{value.price_delta > 0 ? ` +${money(value.price_delta, language)}` : ""}
            </button>;
          })}</div>
        </div>)}

        {existingTarget && !stockConflict && <div className="cart-editor-info-v216">{language === "fr" ? "Cette configuration existe déjà : les quantités seront regroupées." : "This configuration is already in your cart: quantities will be merged."}</div>}
        {stockConflict && <div className="cart-editor-error-v216">{language === "fr" ? `Stock insuffisant pour regrouper les quantités (${maxStock} disponible${maxStock === 1 ? "" : "s"}).` : `Not enough stock to merge quantities (${maxStock} available).`}</div>}
      </div>

      <div className="cart-editor-footer-v216">
        <div><small>{language === "fr" ? "Nouveau prix unitaire" : "New unit price"}</small><strong>{money(nextUnitPrice, language)}</strong></div>
        <div><button type="button" className="button ghost" onClick={onClose}>{language === "fr" ? "Annuler" : "Cancel"}</button><button type="button" className="button primary" disabled={!canSave} onClick={save}>{language === "fr" ? "Enregistrer les modifications" : "Save changes"}</button></div>
      </div>
    </div>
  </div>, document.body);
}
