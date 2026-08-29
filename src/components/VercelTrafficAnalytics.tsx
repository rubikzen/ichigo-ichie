"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type AnalyticsEvent = {
  url: string;
  [key: string]: unknown;
};

type AnalyticsCallback = (event: AnalyticsEvent) => AnalyticsEvent | null;
type AnalyticsQueueItem = [string, AnalyticsCallback?];
type AnalyticsFunction = (command: string, callback?: AnalyticsCallback) => void;

type AnalyticsWindow = Window & {
  va?: AnalyticsFunction;
  vaq?: AnalyticsQueueItem[];
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const PRODUCTION_HOSTS = new Set([
  "www.ichigoichiematcha.fr",
  "ichigoichiematcha.fr",
]);
const TRAFFIC_ENDPOINT = "/api/analytics/traffic";
const TRAFFIC_SESSION_KEY = "ichigo:traffic-session:v4891";

let fallbackTrafficSessionId = "";
let lastTrackedPath = "";

function shouldIgnorePath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  );
}

function trafficSessionId() {
  try {
    const existing = window.sessionStorage.getItem(TRAFFIC_SESSION_KEY);
    if (existing) return existing;

    const randomPart =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    const next = `traffic-${randomPart}`;
    window.sessionStorage.setItem(TRAFFIC_SESSION_KEY, next);
    return next;
  } catch {
    if (!fallbackTrafficSessionId) {
      fallbackTrafficSessionId = `traffic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 14)}`;
    }
    return fallbackTrafficSessionId;
  }
}

function recordFirstPartyPageview(pathname: string) {
  const body = JSON.stringify({
    session_id: trafficSessionId(),
    path: pathname,
  });

  try {
    if (typeof navigator.sendBeacon === "function") {
      const accepted = navigator.sendBeacon(
        TRAFFIC_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      if (accepted) return;
    }
  } catch {
    // Fall through to keepalive fetch.
  }

  void fetch(TRAFFIC_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Traffic analytics must never interrupt storefront behavior.
  });
}

export function VercelTrafficAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!PRODUCTION_HOSTS.has(window.location.hostname)) return;

    const analyticsWindow = window as AnalyticsWindow;
    const va: AnalyticsFunction =
      analyticsWindow.va ??
      ((command, callback) => {
        (analyticsWindow.vaq ??= []).push([command, callback]);
      });

    analyticsWindow.va = va;
    va("beforeSend", (event) => {
      try {
        const eventPathname = new URL(event.url).pathname;
        return shouldIgnorePath(eventPathname) ? null : event;
      } catch {
        return event;
      }
    });

    if (shouldIgnorePath(window.location.pathname)) return;
    if (document.querySelector('script[data-ichigo-vercel-analytics="v489"]')) {
      return;
    }

    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const appendScript = () => {
      if (document.querySelector('script[data-ichigo-vercel-analytics="v489"]')) {
        return;
      }
      const script = document.createElement("script");
      script.defer = true;
      script.src = "/_vercel/insights/script.js";
      script.dataset.ichigoVercelAnalytics = "v489";
      document.head.appendChild(script);
    };

    const scheduleScript = () => {
      if (analyticsWindow.requestIdleCallback) {
        idleHandle = analyticsWindow.requestIdleCallback(appendScript, { timeout: 1500 });
      } else {
        timeoutHandle = window.setTimeout(appendScript, 600);
      }
    };

    if (document.readyState === "complete") {
      scheduleScript();
    } else {
      window.addEventListener("load", scheduleScript, { once: true });
    }

    return () => {
      window.removeEventListener("load", scheduleScript);
      if (idleHandle !== undefined) analyticsWindow.cancelIdleCallback?.(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, []);

  useEffect(() => {
    if (!PRODUCTION_HOSTS.has(window.location.hostname)) return;
    const currentPath = pathname || window.location.pathname || "/";
    if (shouldIgnorePath(currentPath) || lastTrackedPath === currentPath) return;

    lastTrackedPath = currentPath;
    recordFirstPartyPageview(currentPath);
  }, [pathname]);

  return null;
}
