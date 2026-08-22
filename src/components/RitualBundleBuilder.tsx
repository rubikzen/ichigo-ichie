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
  ritualBundleModeFromSetting,
  ritualBundlePercentFromSetting,
  ritualBundlePercentLabel,
  ritualBundleRateFromSetting,
} from "@/lib/bundle";

const moneyFormatters = {
  fr: new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }),
  en: new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }),
} as const;

function stockUsed(
  productId: string,
  variantId: string | null | undefined,
  items: CartItem[],
) {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (variantId) return item.variantId === variantId ? sum + item.quantity : sum;
    return item.variantId ? sum : sum + item.quantity;
  }, 0);
}

function stockUnitKey(product: Product, variant: Variant | null) {
  return `${product.id}|${variant?.id ?? "base"}`;
}

function selectVariant(product: Product, variantId: string) {
  return (
    availableBundleVariants(product).find((variant) => variant.id === variantId) ??
    firstAvailableBundleVariant(product)
  );
}

export function RitualBundleBuilder({ products }: { products: Product[] }) {
  const { language } = useLanguage();
  const { settings } = useSiteSettings();
  const { items, addItem } = useCart();

  const mode = ritualBundleModeFromSetting(settings.shop_ritual_bundle_mode);
  const discountPercent = ritualBundlePercentFromSetting(
    settings.shop_ritual_bundle_discount_percent,
  );
  const discountRate =
    discountPercent === 5
      ? RITUAL_BUNDLE_RATE
      : ritualBundleRateFromSetting(settings.shop_ritual_bundle_discount_percent);
  const percentLabel = ritualBundlePercentLabel(discountPercent, language);

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
  const secondProducts = mode === "two_matcha" ? matchas : accessories;

  const [firstProductId, setFirstProductId] = useState(matchas[0]?.id ?? "");
  const [secondProductId, setSecondProductId] = useState(secondProducts[0]?.id ?? "");
  const [firstVariantId, setFirstVariantId] = useState(
    matchas[0] ? firstAvailableBundleVariant(matchas[0])?.id ?? "" : "",
  );
  const [secondVariantId, setSecondVariantId] = useState(
    secondProducts[0]
      ? firstAvailableBundleVariant(secondProducts[0])?.id ?? ""
      : "",
  );
  const [added, setAdded] = useState(false);

  if (
    !settingEnabled(settings.shop_ritual_bundle_visible) ||
    !matchas.length ||
    !secondProducts.length
  ) {
    return null;
  }

  const firstProduct =
    matchas.find((product) => product.id === firstProductId) ?? matchas[0];
  const secondProduct =
    secondProducts.find((product) => product.id === secondProductId) ??
    secondProducts[0];

  const firstVariant = selectVariant(firstProduct, firstVariantId);
  const secondVariant = selectVariant(secondProduct, secondVariantId);

  const firstPrice = bundleProductPrice(firstProduct, firstVariant);
  const secondPrice = bundleProductPrice(secondProduct, secondVariant);
  const regularPrice = Math.round((firstPrice + secondPrice) * 100) / 100;
  const ritualPrice =
    Math.round(regularPrice * (1 - discountRate) * 100) / 100;
  const saving = Math.round((regularPrice - ritualPrice) * 100) / 100;

  const selections = [
    { product: firstProduct, variant: firstVariant },
    { product: secondProduct, variant: secondVariant },
  ];

  const requiredByStockUnit = new Map<string, number>();
  for (const selection of selections) {
    const key = stockUnitKey(selection.product, selection.variant);
    requiredByStockUnit.set(key, (requiredByStockUnit.get(key) ?? 0) + 1);
  }

  const canAdd = selections.every((selection) => {
    const key = stockUnitKey(selection.product, selection.variant);
    const required = requiredByStockUnit.get(key) ?? 1;
    const stock = bundleProductStock(selection.product, selection.variant);
    const used = stockUsed(selection.product.id, selection.variant?.id, items);
    return stock - used >= required;
  });

  const money = moneyFormatters[language];

  const chooseFirstProduct = (productId: string) => {
    const next = matchas.find((product) => product.id === productId) ?? matchas[0];
    setFirstProductId(next.id);
    setFirstVariantId(firstAvailableBundleVariant(next)?.id ?? "");
    setAdded(false);
  };

  const chooseSecondProduct = (productId: string) => {
    const next =
      secondProducts.find((product) => product.id === productId) ??
      secondProducts[0];
    setSecondProductId(next.id);
    setSecondVariantId(firstAvailableBundleVariant(next)?.id ?? "");
    setAdded(false);
  };

  const addRitual = () => {
    if (!canAdd) return;
    const groupId = window.crypto.randomUUID();

    const addBundleLine = (
      product: Product,
      variant: Variant | null,
      slot: "a" | "b",
    ) => {
      const name =
        language === "fr" ? product.name_fr : product.name_en || product.name_fr;
      const price = bundleProductPrice(product, variant);

      addItem({
        key: bundleCartKey(product.id, variant?.id, groupId, slot),
        productId: product.id,
        variantId: variant?.id ?? null,
        name: composeProductVariantName(name, variant, language),
        imageUrl: product.images?.[0]?.url || product.image_url || null,
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

    addBundleLine(firstProduct, firstVariant, "a");
    addBundleLine(secondProduct, secondVariant, "b");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  const defaultAccessoryTitle =
    language === "fr"
      ? "Matcha + accessoire · −5 %"
      : "Matcha + accessory · 5% off";

  const title =
    mode === "two_matcha"
      ? language === "fr"
        ? `2 matchas · −${percentLabel} %`
        : `2 matchas · ${percentLabel}% off`
      : discountPercent === 5
        ? defaultAccessoryTitle
        : language === "fr"
          ? `Matcha + accessoire · −${percentLabel} %`
          : `Matcha + accessory · ${percentLabel}% off`;

  return (
    <section
      className="ritual-bundle-v465"
      aria-labelledby="ritual-bundle-title-v465"
    >
      <div className="ritual-bundle-copy-v465">
        <p className="eyebrow">
          {language === "fr" ? "COMPOSEZ VOTRE RITUEL" : "BUILD YOUR RITUAL"}
        </p>
        <h3 id="ritual-bundle-title-v465">{title}</h3>
        <p>
          {language === "fr"
            ? "Choisissez les deux éléments de votre rituel. Stock et disponibilité restent vérifiés au paiement."
            : "Choose both parts of your ritual. Stock and availability are still verified at checkout."}
        </p>
      </div>

      <div className="ritual-bundle-builder-v465">
        <BundleChoice
          index="01"
          label="Matcha"
          product={firstProduct}
          products={matchas}
          variant={firstVariant}
          language={language}
          money={money}
          onProductChange={chooseFirstProduct}
          onVariantChange={(variantId) => {
            setFirstVariantId(variantId);
            setAdded(false);
          }}
        />

        <span className="ritual-bundle-plus-v465" aria-hidden="true">+</span>

        <BundleChoice
          index="02"
          label={
            mode === "two_matcha"
              ? "Matcha"
              : language === "fr"
                ? "Accessoire"
                : "Accessory"
          }
          product={secondProduct}
          products={secondProducts}
          variant={secondVariant}
          language={language}
          money={money}
          onProductChange={chooseSecondProduct}
          onVariantChange={(variantId) => {
            setSecondVariantId(variantId);
            setAdded(false);
          }}
        />

        <div className="ritual-bundle-total-v465">
          <div>
            <small>{language === "fr" ? "Prix séparé" : "Regular price"}</small>
            <s>{money.format(regularPrice)}</s>
          </div>
          <div>
            <small>{language === "fr" ? "Votre rituel" : "Your ritual"}</small>
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

function BundleChoice({
  index,
  label,
  product,
  products,
  variant,
  language,
  money,
  onProductChange,
  onVariantChange,
}: {
  index: string;
  label: string;
  product: Product;
  products: Product[];
  variant: Variant | null;
  language: "fr" | "en";
  money: Intl.NumberFormat;
  onProductChange: (productId: string) => void;
  onVariantChange: (variantId: string) => void;
}) {
  const variants = availableBundleVariants(product);

  return (
    <div className="ritual-bundle-choice-v465">
      <label>
        <span>{index} · {label}</span>
        <select
          value={product.id}
          onChange={(event) => onProductChange(event.target.value)}
        >
          {products.map((row) => (
            <option key={row.id} value={row.id}>
              {language === "fr" ? row.name_fr : row.name_en || row.name_fr}
            </option>
          ))}
        </select>
      </label>

      {variants.length > 1 && (
        <label>
          <span>Format</span>
          <select
            value={variant?.id ?? ""}
            onChange={(event) => onVariantChange(event.target.value)}
          >
            {variants.map((row) => (
              <option key={row.id} value={row.id}>
                {variantLabel(row)} · {money.format(Number(row.price))}
              </option>
            ))}
          </select>
        </label>
      )}

      <strong>{money.format(bundleProductPrice(product, variant))}</strong>
    </div>
  );
}
