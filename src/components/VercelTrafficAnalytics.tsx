"use client";

import { useEffect } from "react";

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
};

const PRODUCTION_HOSTS = new Set([
  "www.ichigoichiematcha.fr",
  "ichigoichiematcha.fr",
]);

function shouldIgnorePath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api" || pathname.startsWith("/api/");
}

export function VercelTrafficAnalytics() {
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
        const pathname = new URL(event.url).pathname;
        return shouldIgnorePath(pathname) ? null : event;
      } catch {
        return event;
      }
    });

    if (shouldIgnorePath(window.location.pathname)) return;
    if (document.querySelector('script[data-ichigo-vercel-analytics="v489"]')) return;

    const script = document.createElement("script");
    script.defer = true;
    script.src = "/_vercel/insights/script.js";
    script.dataset.ichigoVercelAnalytics = "v489";
    document.head.appendChild(script);
  }, []);

  return null;
}
