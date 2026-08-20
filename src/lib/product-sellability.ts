import type { Variant } from "@/lib/types";

export type SellabilityProductInput = {
  base_price: number;
  pickup_only: boolean;
  shipping_weight_g?: number | null;
  image_url?: string | null;
};

export type ProductSellabilityIssue = {
  code: string;
  level: "blocker" | "warning";
  label: string;
};

export type ProductSellabilityCheck = {
  id: "price" | "shipping" | "formats" | "image";
  label: string;
  status: "ready" | "blocker" | "warning";
  detail: string;
};

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function activeVariants(variants: Variant[]) {
  return variants.filter((variant) => variant.active);
}

export function productSellabilityPreflight(
  product: SellabilityProductInput,
  variants: Variant[],
) {
  const issues: ProductSellabilityIssue[] = [];
  const active = activeVariants(variants);
  const add = (
    code: string,
    level: ProductSellabilityIssue["level"],
    label: string,
  ) => issues.push({ code, level, label });

  const basePrice = finiteNumber(product.base_price);
  if (!active.length && (basePrice == null || basePrice < 0)) {
    add("base_price_invalid", "blocker", "Prix produit invalide");
  }

  const invalidPriceVariants = active.filter((variant) => {
    const price = finiteNumber(variant.price);
    return price == null || price < 0;
  });
  if (invalidPriceVariants.length) {
    add(
      "variant_price_invalid",
      "blocker",
      `${invalidPriceVariants.length} format${invalidPriceVariants.length > 1 ? "s" : ""} avec un prix invalide`,
    );
  }

  const invalidLabelVariants = active.filter(
    (variant) =>
      !String(variant.name ?? "").trim() &&
      !String(variant.weight ?? "").trim(),
  );
  if (invalidLabelVariants.length) {
    add(
      "variant_label_missing",
      "blocker",
      `${invalidLabelVariants.length} format${invalidLabelVariants.length > 1 ? "s" : ""} sans nom ni poids`,
    );
  }

  const productWeight = Math.max(0, finiteNumber(product.shipping_weight_g) ?? 0);
  if (!product.pickup_only) {
    const missingWeight =
      active.length === 0
        ? productWeight <= 0
        : productWeight <= 0 &&
          active.some(
            (variant) =>
              Math.max(0, finiteNumber(variant.shipping_weight_g) ?? 0) <= 0,
          );

    if (missingWeight) {
      add(
        "shipping_weight_missing",
        "blocker",
        "Poids d’expédition manquant pour au moins un choix vendable",
      );
    }
  }

  const imageUrl = String(product.image_url ?? "").trim();
  if (!imageUrl || imageUrl === "/product-placeholder.svg") {
    add("primary_image_missing", "warning", "Image principale à vérifier");
  }

  const blockers = issues.filter((issue) => issue.level === "blocker");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const hasPriceBlocker = issues.some((issue) =>
    ["base_price_invalid", "variant_price_invalid"].includes(issue.code),
  );
  const hasShippingBlocker = issues.some(
    (issue) => issue.code === "shipping_weight_missing",
  );
  const hasFormatBlocker = issues.some(
    (issue) => issue.code === "variant_label_missing",
  );
  const hasImageWarning = issues.some(
    (issue) => issue.code === "primary_image_missing",
  );

  const checks: ProductSellabilityCheck[] = [
    {
      id: "price",
      label: "Prix",
      status: hasPriceBlocker ? "blocker" : "ready",
      detail: hasPriceBlocker
        ? "Corrigez les prix négatifs ou invalides."
        : active.length
          ? "Tous les formats actifs ont un prix exploitable."
          : "Le prix produit est exploitable.",
    },
    {
      id: "shipping",
      label: product.pickup_only ? "Retrait" : "Livraison",
      status: hasShippingBlocker ? "blocker" : "ready",
      detail: product.pickup_only
        ? "Aucun poids d’expédition requis pour ce produit."
        : hasShippingBlocker
          ? "Ajoutez un poids produit ou un poids à chaque format actif."
          : "Le calcul du poids d’expédition est possible.",
    },
    {
      id: "formats",
      label: "Formats",
      status: hasFormatBlocker ? "blocker" : "ready",
      detail: hasFormatBlocker
        ? "Chaque format actif doit avoir un nom ou un poids."
        : active.length
          ? `${active.length} format${active.length > 1 ? "s" : ""} actif${active.length > 1 ? "s" : ""} exploitable${active.length > 1 ? "s" : ""}.`
          : "Aucun format actif : le produit utilise son prix et son stock de base.",
    },
    {
      id: "image",
      label: "Photo",
      status: hasImageWarning ? "warning" : "ready",
      detail: hasImageWarning
        ? "La publication reste possible, mais une vraie image produit est recommandée."
        : "Une image principale est configurée.",
    },
  ];

  return {
    issues,
    blockers,
    warnings,
    checks,
    readyToSell: blockers.length === 0,
  };
}
