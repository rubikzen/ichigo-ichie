"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { settingEnabled } from "@/lib/settings";

export type ProductReviewSummary = { count: number; average: number };
type SummaryMap = Record<string, ProductReviewSummary>;

const ReviewSummaryContext = createContext<SummaryMap>({});

export function ReviewSummaryProvider({
  productIds,
  children,
}: {
  productIds: string[];
  children: React.ReactNode;
}) {
  const { settings } = useSiteSettings();
  const [summaries, setSummaries] = useState<SummaryMap>({});

  const enabled =
    settingEnabled(settings.shop_reviews_enabled) &&
    settingEnabled(settings.shop_reviews_show_rating) &&
    settingEnabled(settings.shop_reviews_card_rating_visible);

  const idsKey = [...new Set(productIds)].filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!enabled || !idsKey) return;
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/reviews/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds: idsKey.split(",") }),
        });
        const data = (await response.json()) as { summaries?: SummaryMap };
        if (active && response.ok) setSummaries(data.summaries ?? {});
      } catch {
        // Review merchandising must never block shopping.
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [enabled, idsKey]);

  return (
    <ReviewSummaryContext.Provider value={enabled ? summaries : {}}>
      {children}
    </ReviewSummaryContext.Provider>
  );
}

export function useProductReviewSummary(productId: string) {
  return useContext(ReviewSummaryContext)[productId] ?? null;
}
