"use client";

import type { CSSProperties } from "react";
import { useSiteSettings } from "@/components/SiteSettingsProvider";
import { christmasOptions } from "@/lib/christmas-theme";

function ChristmasTree() {
  return (
    <svg viewBox="0 0 98 138" className="noel-tree-svg-v502" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ichigo-noel-tree" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#317654" />
          <stop offset="1" stopColor="#174b39" />
        </linearGradient>
      </defs>
      <path d="M49 11 55 23 68 25 58 34 61 47 49 40 37 47 40 34 30 25 43 23Z" fill="#e6bb70" />
      <path d="M44 101h10v26H44z" fill="#8e5841" />
      <path d="M49 32 22 70h14L12 100h74L62 70h14Z" fill="url(#ichigo-noel-tree)" />
      <path d="M27 75c13 5 31 9 46 0M19 98c16-5 43-6 60 0" fill="none" stroke="#d6b46d" strokeWidth="2" strokeLinecap="round" opacity=".9" />
      <circle cx="50" cy="62" r="3.6" fill="#f4d99a" />
      <circle cx="35" cy="83" r="4.2" fill="#bb5960" />
      <circle cx="63" cy="88" r="3.7" fill="#edc174" />
      <circle cx="47" cy="93" r="3.2" fill="#f1efdc" />
      <rect x="24" y="113" width="19" height="16" rx="2" fill="#a3444b" />
      <path d="M33 113v16m-9-9h19" stroke="#f2d69b" strokeWidth="2" />
      <rect x="57" y="116" width="16" height="13" rx="2" fill="#d3ae6e" />
      <path d="M65 116v13m-8-7h16" stroke="#fff0d5" strokeWidth="2" />
    </svg>
  );
}

/** Decorative only: no document listeners, canvas or network requests. */
export function SeasonalDecor() {
  const { settings } = useSiteSettings();
  const { enabled, intensity, snow, decor } = christmasOptions(settings);
  if (!enabled) return null;

  const count = snow ? (intensity === "full" ? 30 : 17) : 0;
  return (
    <div className={`seasonal-layer-v502 seasonal-layer-${intensity}-v502`} aria-hidden="true">
      {count > 0 && (
        <div className="seasonal-snow-v502" data-seasonal-snow-v502>
          {Array.from({ length: count }, (_, i) => {
            const style: CSSProperties = {
              left: `${(i * 37 + 13) % 100}%`,
              width: `${3 + (i % 4) * 1.3}px`,
              height: `${3 + (i % 4) * 1.3}px`,
              animationDelay: `${-((i * 7) % 19)}s`,
              animationDuration: `${11 + (i % 7) * 2.1}s`,
              opacity: 0.25 + (i % 5) * 0.12,
            };
            return <span className="seasonal-flake-v502" style={style} key={i} />;
          })}
        </div>
      )}
      {decor && intensity !== "soft" && (
        <div className="seasonal-tree-v502" data-seasonal-tree-v502>
          <ChristmasTree />
        </div>
      )}
      {decor && intensity === "full" && (
        <div className="seasonal-santa-v502" data-seasonal-santa-v502>
          <span className="seasonal-santa-stars-v502">✦</span>
          <span className="seasonal-santa-figure-v502">🎅</span>
          <span className="seasonal-santa-sleigh-v502">🛷</span>
          <span className="seasonal-santa-stars-v502">✦</span>
        </div>
      )}
    </div>
  );
}
