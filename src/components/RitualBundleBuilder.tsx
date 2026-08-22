"use client";

import { useMemo, useState } from "react";
import type { CartItem, Product, Variant } from "@/lib/types";
import { useCart } from "@/components/CartProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { trackConversion } from "@/lib/conversion-analytics";
import { settingEnabled } from "@/lib/settings";
import { composeProductVariantName, variantLabel } from "@/lib/product-label";
import {
  RITUAL_BUNDLE_ID,
  RITUAL_BUNDLE_RATE,
  availableBundleVariants,
  bundleCartKey,
  bundleProductPrice,
  bundleProductStock,
  firstAvailableBundleVariant,
  isRitualBundleCandidate,
} from "@/lib/bundle";

const moneyFormatters = {
  fr: new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }),
  en: new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }),
} as const;

function stockUsed(
  productId: string,
  variantId: string | null | undefined,
  items: CartItem[],
) {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (variantId) {
      return item.variantId === variantId ? sum + item.quantity : sum;
    }
    return item.variantId ? sum : sum + item.quantity;
  }, 0);
}

function selectVariant(product: Product, variantId: string) {
  return (
    availableBundleVariants(product).find(
      (variant) => variant.id === variantId,
    ) ??
    firstAvailableBundleVariant(product)
  );
}

export function RitualBundleBuilder({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const { items, addItem } = useCart();

  const candidates = useMemo(
    () => products.filter(isRitualBundleCandidate),
    [products],
  );
  const matchas = useMemo(
    () => candidates.filter((product) => product.type === "product"),
    [candidates],
  );
  const accessories = useMemo(
    () => candidates.filter((product) => product.type === "accessory"),
    [candidates],
  );

  const [matchaId, setMatchaId] = useState(matchas[0]?.id ?? "");
  const [accessoryId, setAccessoryId] = useState(accessories[0]?.id ?? "");
  const [matchaVariantId, setMatchaVariantId] = useState(
    matchas[0] ? firstAvailableBundleVariant(matchas[0])?.id ?? "" : "",
  );
  const [accessoryVariantId, setAccessoryVariantId] = useState(
    accessories[0]
      ? firstAvailableBundleVariant(accessories[0])?.id ?? ""
      : "",
  );
  const [added, setAdded] = useState(false);

  if (
    !settingEnabled(settings.shop_ritual_bundle_visible) ||
    !matchas.length ||
    !accessories.length
  ) {
    return null;
  }

  const matcha =
    matchas.find((product) => product.id === matchaId) ?? matchas[0];
  const accessory =
    accessories.find((product) => product.id === accessoryId) ?? accessories[0];

  const matchaVariant = selectVariant(matcha, matchaVariantId);
  const accessoryVariant = selectVariant(accessory, accessoryVariantId);

  const matchaPrice = bundleProductPrice(matcha, matchaVariant);
  const accessoryPrice = bundleProductPrice(accessory, accessoryVariant);
  const regularPrice = Math.round((matchaPrice + accessoryPrice) * 100) / 100;
  const ritualPrice =
    Math.round(regularPrice * (1 - RITUAL_BUNDLE_RATE) * 100) / 100;
  const saving = Math.round((regularPrice - ritualPrice) * 100) / 100;

  const matchaStock = bundleProductStock(matcha, matchaVariant);
  const accessoryStock = bundleProductStock(accessory, accessoryVariant);
  const matchaUsed = stockUsed(matcha.id, matchaVariant?.id, items);
  const accessoryUsed = stockUsed(
    accessory.id,
    accessoryVariant?.id,
    items,
  );

  const canAdd =
    matchaStock - matchaUsed > 0 &&
    accessoryStock - accessoryUsed > 0;

  const money = moneyFormatters[language];

  const chooseMatcha = (productId: string) => {
    const next =
      matchas.find((product) => product.id === productId) ?? matchas[0];
    setMatchaId(next.id);
    setMatchaVariantId(firstAvailableBundleVariant(next)?.id ?? "");
    setAdded(false);
  };

  const chooseAccessory = (productId: string) => {
    const next =
      accessories.find((product) => product.id === productId) ??
      accessories[0];
    setAccessoryId(next.id);
    setAccessoryVariantId(firstAvailableBundleVariant(next)?.id ?? "");
    setAdded(false);
  };

  const addRitual = () => {
    if (!canAdd) return;

    const groupId = window.crypto.randomUUID();

    const addBundleLine = (
      product: Product,
      variant: Variant | null,
    ) => {
      const name =
        language === "fr"
          ? product.name_fr
          : product.name_en || product.name_fr;
      const price = bundleProductPrice(product, variant);

      addItem({
        key: bundleCartKey(product.id, variant?.id, groupId),
        productId: product.id,
        variantId: variant?.id ?? null,
        name: composeProductVariantName(name, variant, language),
        imageUrl:
          product.images?.[0]?.url ||
          product.image_url ||
          null,
        unitPrice: price,
        pickupOnly: product.pickup_only,
        bundleId: RITUAL_BUNDLE_ID,
        bundleGroupId: groupId,
        choices: [],
      });

      trackConversion("add_to_cart", {
        product_id: product.id,
        variant_id: variant?.id,
        value: price,
        quantity: 1,
        item_count: 1,
        currency: "EUR",
      });
    };

    addBundleLine(matcha, matchaVariant);
    addBundleLine(accessory, accessoryVariant);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <section
      className="ritual-bundle-v465"
      aria-labelledby="ritual-bundle-title-v465"
    >
      <div className="ritual-bundle-copy-v465">
        <p className="eyebrow">
          {language === "fr"
            ? "COMPOSEZ VOTRE RITUEL"
            : "BUILD YOUR RITUAL"}
        </p>
        <h3 id="ritual-bundle-title-v465">
          {language === "fr"
            ? "Matcha + accessoire · −5 %"
            : "Matcha + accessory · 5% off"}
        </h3>
        <p>
          {language === "fr"
            ? "Choisissez les deux éléments de votre rituel. Stock et disponibilité restent vérifiés au paiement."
            : "Choose both parts of your ritual. Stock and availability are still verified at checkout."}
        </p>
      </div>

      <div className="ritual-bundle-builder-v465">
        <div className="ritual-bundle-choice-v465">
          <label>
            <span>01 · Matcha</span>
            <select
              value={matcha.id}
              onChange={(event) => chooseMatcha(event.target.value)}
            >
              {matchas.map((product) => (
                <option key={product.id} value={product.id}>
                  {language === "fr"
                    ? product.name_fr
                    : product.name_en || product.name_fr}
                </option>
              ))}
            </select>
          </label>

          {availableBundleVariants(matcha).length > 1 && (
            <label>
              <span>Format</span>
              <select
                value={matchaVariant?.id ?? ""}
                onChange={(event) => {
                  setMatchaVariantId(event.target.value);
                  setAdded(false);
                }}
              >
                {availableBundleVariants(matcha).map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variantLabel(variant)} ·{" "}
                    {money.format(Number(variant.price))}
                  </option>
                ))}
              </select>
            </label>
          )}

          <strong>{money.format(matchaPrice)}</strong>
        </div>

        <span className="ritual-bundle-plus-v465" aria-hidden="true">
          +
        </span>

        <div className="ritual-bundle-choice-v465">
          <label>
            <span>
              02 · {language === "fr" ? "Accessoire" : "Accessory"}
            </span>
            <select
              value={accessory.id}
              onChange={(event) =>
                chooseAccessory(event.target.value)
              }
            >
              {accessories.map((product) => (
                <option key={product.id} value={product.id}>
                  {language === "fr"
                    ? product.name_fr
                    : product.name_en || product.name_fr}
                </option>
              ))}
            </select>
          </label>

          {availableBundleVariants(accessory).length > 1 && (
            <label>
              <span>Format</span>
              <select
                value={accessoryVariant?.id ?? ""}
                onChange={(event) => {
                  setAccessoryVariantId(event.target.value);
                  setAdded(false);
                }}
              >
                {availableBundleVariants(accessory).map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variantLabel(variant)} ·{" "}
                    {money.format(Number(variant.price))}
                  </option>
                ))}
              </select>
            </label>
          )}

          <strong>{money.format(accessoryPrice)}</strong>
        </div>

        <div className="ritual-bundle-total-v465">
          <div>
            <small>
              {language === "fr" ? "Prix séparé" : "Regular price"}
            </small>
            <s>{money.format(regularPrice)}</s>
          </div>
          <div>
            <small>
              {language === "fr" ? "Votre rituel" : "Your ritual"}
            </small>
            <strong>{money.format(ritualPrice)}</strong>
          </div>
          <span>
            {language === "fr"
              ? `Vous économisez ${money.format(saving)}`
              : `You save ${money.format(saving)}`}
          </span>
        </div>

        <button
          type="button"
          className="button primary ritual-bundle-cta-v465"
          onClick={addRitual}
          disabled={!canAdd}
        >
          {added
            ? language === "fr"
              ? "✓ Rituel ajouté"
              : "✓ Ritual added"
            : !canAdd
              ? language === "fr"
                ? "Stock insuffisant"
                : "Not enough stock"
              : language === "fr"
                ? "Ajouter le rituel au panier"
                : "Add ritual to cart"}
        </button>
      </div>
    </section>
  );
}
