"use client";

const CHANNEL = "ichigo-catalog-updates";
const STORAGE_KEY = "ichigo-catalog-refresh";

export function broadcastCatalogUpdate() {
  if (typeof window === "undefined") return;
  const stamp = Date.now();
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ type: "catalog-refresh", stamp });
    channel.close();
  } catch {}
  try {
    window.localStorage.setItem(STORAGE_KEY, String(stamp));
  } catch {}
}

export function subscribeCatalogUpdate(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event) => {
      if (event?.data?.type === "catalog-refresh") callback();
    };
  } catch {}
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    try { channel?.close(); } catch {}
  };
}
