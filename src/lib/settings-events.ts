const EVENT_NAME = "ichigo:settings-updated";
const STORAGE_KEY = "ichigo-settings-updated-at";

export function broadcastSiteSettingsUpdate() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  try { window.localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* noop */ }
}

export function subscribeSiteSettingsUpdate(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onCustom = () => callback();
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) callback(); };
  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
