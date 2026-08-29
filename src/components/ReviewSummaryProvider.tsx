"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { settingEnabled } from "@/lib/settings";

export type ProductReviewSummary = { count: number; average: number };
type SummaryMap = Record<string, ProductReviewSummary>;

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

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
    const controller = new AbortController();
    const idleWindow = window as IdleWindow;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/reviews/summary", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productIds: idsKey.split(",") }),
          signal: controller.signal,
        });
        const data = (await response.json()) as { summaries?: SummaryMap };
        if (active && response.ok) setSummaries(data.summaries ?? {});
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Review merchandising must never block shopping.
      }
    }

    // Ratings are useful merchandising, but they are not part of the LCP path.
    // Let the hero image, CSS and primary catalogue hydration win the first turn.
    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(() => void load(), { timeout: 1200 });
    } else {
      timeoutHandle = window.setTimeout(() => void load(), 350);
    }

    return () => {
      active = false;
      controller.abort();
      if (idleHandle !== undefined) idleWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
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
