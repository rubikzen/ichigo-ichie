"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { settingEnabled } from "@/lib/settings";

export type ProductReviewSummary = { count: number; average: number };
type SummaryMap = Record<string, ProductReviewSummary>;
type ReviewSummaryListener = () => void;

type ReviewSummaryStore = {
  getSummary: (productId: string) => ProductReviewSummary | null;
  subscribe: (productId: string, listener: ReviewSummaryListener) => () => void;
  replace: (nextSummaries: SummaryMap) => void;
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function summariesEqual(
  left: ProductReviewSummary | undefined,
  right: ProductReviewSummary | undefined,
) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.count === right.count && left.average === right.average;
}

function createReviewSummaryStore(): ReviewSummaryStore {
  let summaries: SummaryMap = {};
  const listeners = new Map<string, Set<ReviewSummaryListener>>();

  return {
    getSummary(productId) {
      return summaries[productId] ?? null;
    },
    subscribe(productId, listener) {
      const productListeners = listeners.get(productId) ?? new Set<ReviewSummaryListener>();
      productListeners.add(listener);
      listeners.set(productId, productListeners);

      return () => {
        productListeners.delete(listener);
        if (productListeners.size === 0) listeners.delete(productId);
      };
    },
    replace(nextSummaries) {
      const previousSummaries = summaries;
      summaries = nextSummaries;

      const productIds = new Set([
        ...Object.keys(previousSummaries),
        ...Object.keys(nextSummaries),
      ]);

      productIds.forEach((productId) => {
        if (summariesEqual(previousSummaries[productId], nextSummaries[productId])) return;
        listeners.get(productId)?.forEach((listener) => listener());
      });
    },
  };
}

const emptyReviewSummaryStore: ReviewSummaryStore = {
  getSummary: () => null,
  subscribe: () => () => undefined,
  replace: () => undefined,
};

const ReviewSummaryContext = createContext<ReviewSummaryStore>(emptyReviewSummaryStore);

export function ReviewSummaryProvider({
  productIds,
  children,
}: {
  productIds: string[];
  children: React.ReactNode;
}) {
  const { settings } = useSiteSettings();
  const [store] = useState(createReviewSummaryStore);

  const enabled =
    settingEnabled(settings.shop_reviews_enabled) &&
    settingEnabled(settings.shop_reviews_show_rating) &&
    settingEnabled(settings.shop_reviews_card_rating_visible);

  const idsKey = [...new Set(productIds)].filter(Boolean).sort().join(",");

  useEffect(() => {
    if (!enabled || !idsKey) {
      store.replace({});
      return;
    }

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
        if (active && response.ok) store.replace(data.summaries ?? {});
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
  }, [enabled, idsKey, store]);

  return (
    <ReviewSummaryContext.Provider value={store}>
      {children}
    </ReviewSummaryContext.Provider>
  );
}

export function useProductReviewSummary(productId: string) {
  const store = useContext(ReviewSummaryContext);
  const subscribe = useCallback(
    (listener: ReviewSummaryListener) => store.subscribe(productId, listener),
    [productId, store],
  );
  const getSnapshot = useCallback(
    () => store.getSummary(productId),
    [productId, store],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
