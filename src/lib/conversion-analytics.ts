"use client";

export type ConversionEventName =
  | "product_view"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";

export type ConversionEventPayload = {
  product_id?: string;
  variant_id?: string | null;
  value?: number;
  quantity?: number;
  item_count?: number;
  currency?: "EUR";
  source?: "product_page" | "product_modal";
  order_type?: "pickup" | "shipping";
  transaction_id?: string;
};

type TrackOptions = {
  dedupeKey?: string;
  persistent?: boolean;
};

const ENDPOINT = "/api/analytics/conversion";
const SESSION_KEY = "ichigo:conversion-session:v463";
const DEDUPE_PREFIX = "ichigo:conversion-dedupe:v463:";

function safeStorage(persistent: boolean) {
  try {
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function sessionId() {
  const storage = safeStorage(false);
  const existing = storage?.getItem(SESSION_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    storage?.setItem(SESSION_KEY, next);
  } catch {
    // Session correlation is best-effort only.
  }
  return next;
}

function wasAlreadyTracked(key: string, persistent: boolean) {
  const storage = safeStorage(persistent);
  const storageKey = `${DEDUPE_PREFIX}${key}`;
  try {
    if (storage?.getItem(storageKey)) return true;
    storage?.setItem(storageKey, String(Date.now()));
  } catch {
    // Dedupe is best-effort only.
  }
  return false;
}

export function trackConversion(
  event: ConversionEventName,
  payload: ConversionEventPayload = {},
  options: TrackOptions = {},
) {
  if (typeof window === "undefined") return false;

  if (
    options.dedupeKey &&
    wasAlreadyTracked(options.dedupeKey, Boolean(options.persistent))
  ) {
    return false;
  }

  const eventPayload = {
    event,
    session_id: sessionId(),
    occurred_at: new Date().toISOString(),
    path: window.location.pathname,
    ...payload,
  };

  window.dispatchEvent(
    new CustomEvent("ichigo:conversion", { detail: eventPayload }),
  );

  const body = JSON.stringify(eventPayload);

  try {
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (accepted) return true;
    }
  } catch {
    // Fall through to keepalive fetch.
  }

  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Analytics must never interrupt storefront behavior.
  });

  return true;
}
