"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { trackConversion } from "@/lib/conversion-analytics";
import type { CartChoice } from "@/lib/types";

type PreparedChoice = {
  groupId: string;
  groupNameFr: string;
  groupNameEn: string;
  valueId: string;
  valueNameFr: string;
  valueNameEn: string;
  priceDelta: number;
};

type PreparedItem = {
  historicalItemId: string;
  productId: string;
  variantId: string | null;
  stockUnitKey: string;
  key: string;
  requestedQuantity: number;
  availableStock: number;
  nameFr: string;
  nameEn: string;
  imageUrl: string | null;
  unitPrice: number;
  pickupOnly: boolean;
  productUrl: string;
  choices: PreparedChoice[];
};

type ReorderIssue = {
  historicalItemId: string;
  productName: string;
  quantity: number;
  reason:
    | "legacy_item"
    | "product_unavailable"
    | "out_of_stock"
    | "configuration_changed";
  productUrl: string | null;
};

type ReorderPayload = {
  orderNumber: string;
  items: PreparedItem[];
  issues: ReorderIssue[];
  previousPromotionIgnored: boolean;
  error?: string;
  code?: string;
};

type ResultState = {
  addedUnits: number;
  addedLines: number;
  notAddedUnits: number;
  partialLines: number;
  issues: ReorderIssue[];
  promotionReset: boolean;
};

function issueLabel(
  issue: ReorderIssue,
  language: "fr" | "en",
) {
  if (issue.reason === "out_of_stock") {
    return language === "fr"
      ? "rupture de stock"
      : "out of stock";
  }
  if (issue.reason === "configuration_changed") {
    return language === "fr"
      ? "format ou options à reconfigurer"
      : "format or options need reconfiguration";
  }
  if (issue.reason === "product_unavailable") {
    return language === "fr"
      ? "produit indisponible"
      : "product unavailable";
  }
  return language === "fr"
    ? "ancien article non compatible"
    : "legacy item cannot be restored";
}

export function ReorderOrderButton({
  token,
  orderNumber,
  compact = false,
}: {
  token: string;
  orderNumber: string;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const { items: cartItems, addItem } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);

  async function reorder() {
    if (loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(token)}/reorder`,
        {
          method: "POST",
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as ReorderPayload;

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (language === "fr"
              ? "Impossible de préparer le panier."
              : "Unable to prepare the cart."),
        );
      }

      const stockReserved = new Map<string, number>();
      const keyReserved = new Map<string, number>();

      for (const item of cartItems) {
        const stockUnitKey = `${item.productId}|${
          item.variantId ?? "base"
        }`;
        stockReserved.set(
          stockUnitKey,
          (stockReserved.get(stockUnitKey) ?? 0) +
            Math.max(0, Number(item.quantity || 0)),
        );
        keyReserved.set(
          item.key,
          (keyReserved.get(item.key) ?? 0) +
            Math.max(0, Number(item.quantity || 0)),
        );
      }

      let addedUnits = 0;
      let addedLines = 0;
      let partialLines = 0;
      let stockLimitedUnits = 0;

      for (const prepared of payload.items ?? []) {
        const alreadyOnStockUnit =
          stockReserved.get(prepared.stockUnitKey) ?? 0;
        const alreadyOnKey = keyReserved.get(prepared.key) ?? 0;
        const remainingStock = Math.max(
          0,
          prepared.availableStock - alreadyOnStockUnit,
        );
        const remainingLineCapacity = Math.max(0, 20 - alreadyOnKey);
        const quantity = Math.max(
          0,
          Math.min(
            prepared.requestedQuantity,
            remainingStock,
            remainingLineCapacity,
          ),
        );

        if (quantity <= 0) {
          stockLimitedUnits += prepared.requestedQuantity;
          partialLines += 1;
          continue;
        }

        const choices: CartChoice[] = prepared.choices.map((choice) => ({
          groupId: choice.groupId,
          groupName:
            language === "fr"
              ? choice.groupNameFr
              : choice.groupNameEn,
          valueId: choice.valueId,
          valueName:
            language === "fr"
              ? choice.valueNameFr
              : choice.valueNameEn,
          priceDelta: choice.priceDelta,
        }));

        addItem({
          key: prepared.key,
          productId: prepared.productId,
          variantId: prepared.variantId,
          name:
            language === "fr"
              ? prepared.nameFr
              : prepared.nameEn,
          imageUrl: prepared.imageUrl,
          unitPrice: prepared.unitPrice,
          quantity,
          pickupOnly: prepared.pickupOnly,
          choices,
        });

        stockReserved.set(
          prepared.stockUnitKey,
          alreadyOnStockUnit + quantity,
        );
        keyReserved.set(prepared.key, alreadyOnKey + quantity);
        addedUnits += quantity;
        addedLines += 1;

        if (quantity < prepared.requestedQuantity) {
          partialLines += 1;
          stockLimitedUnits +=
            prepared.requestedQuantity - quantity;
        }

        trackConversion("add_to_cart", {
          product_id: prepared.productId,
          variant_id: prepared.variantId,
          value: prepared.unitPrice,
          quantity,
          item_count: quantity,
          currency: "EUR",
          source: "reorder",
        });
      }

      const unavailableUnits = (payload.issues ?? []).reduce(
        (sum, issue) => sum + Math.max(0, Number(issue.quantity || 0)),
        0,
      );

      setResult({
        addedUnits,
        addedLines,
        notAddedUnits: unavailableUnits + stockLimitedUnits,
        partialLines,
        issues: payload.issues ?? [],
        promotionReset: Boolean(payload.previousPromotionIgnored),
      });
    } catch (reorderError) {
      setError(
        reorderError instanceof Error
          ? reorderError.message
          : language === "fr"
            ? "Impossible de préparer le panier."
            : "Unable to prepare the cart.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={`reorder-order-v468 ${
        compact ? "compact-v468" : ""
      }`}
    >
      <div className="reorder-order-action-v468">
        <button
          type="button"
          className={compact ? "button ghost small" : "button primary"}
          onClick={() => void reorder()}
          disabled={loading}
        >
          {loading
            ? language === "fr"
              ? "Vérification…"
              : "Checking…"
            : language === "fr"
              ? "Commander à nouveau"
              : "Order again"}
        </button>

        <small>
          {language === "fr"
            ? "Prix, disponibilité et options actuels."
            : "Current prices, availability and options."}
        </small>
      </div>

      {error && (
        <p className="reorder-order-error-v468" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div
          className="reorder-order-result-v468"
          aria-live="polite"
        >
          {result.addedUnits > 0 ? (
            <>
              <strong>
                {language === "fr"
                  ? `${result.addedUnits} article(s) ajouté(s) au panier.`
                  : `${result.addedUnits} item(s) added to your cart.`}
              </strong>
              <div className="reorder-order-result-actions-v468">
                <Link className="button primary small" href="/panier">
                  {language === "fr"
                    ? "Voir mon panier"
                    : "View cart"}
                </Link>
                <Link className="button ghost small" href="/#boutique">
                  {language === "fr"
                    ? "Continuer mes achats"
                    : "Continue shopping"}
                </Link>
              </div>
            </>
          ) : (
            <strong>
              {language === "fr"
                ? "Aucun article n’a pu être ajouté."
                : "No items could be added."}
            </strong>
          )}

          {result.notAddedUnits > 0 && (
            <p>
              {language === "fr"
                ? `${result.notAddedUnits} unité(s) non ajoutée(s) : stock ou configuration actuelle différente.`
                : `${result.notAddedUnits} unit(s) were not added because stock or configuration has changed.`}
            </p>
          )}

          {result.promotionReset && (
            <p>
              {language === "fr"
                ? "La réduction ou promotion de l’ancienne commande n’est pas recopiée ; les offres actuelles s’appliquent."
                : "The previous order’s discount or promotion is not copied; current offers apply."}
            </p>
          )}

          {result.issues.length > 0 && (
            <details>
              <summary>
                {language === "fr"
                  ? "Articles à vérifier"
                  : "Items to review"}
              </summary>
              <ul>
                {result.issues.slice(0, 8).map((issue) => (
                  <li key={issue.historicalItemId}>
                    <span>
                      {issue.quantity} × {issue.productName} —{" "}
                      {issueLabel(issue, language)}
                    </span>
                    {issue.productUrl && (
                      <Link href={issue.productUrl}>
                        {language === "fr"
                          ? "Reconfigurer"
                          : "Configure"}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <span className="sr-only">
        {language === "fr"
          ? `Nouvelle commande basée sur ${orderNumber}`
          : `New order based on ${orderNumber}`}
      </span>
    </div>
  );
}
