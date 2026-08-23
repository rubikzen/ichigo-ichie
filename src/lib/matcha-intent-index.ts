import type { MatchaFinderTag } from "@/lib/product-merchandising";

export type MatchaIntentSummary = {
  tag: Extract<MatchaFinderTag, "usucha" | "koicha" | "latte" | "ceremonial">;
  href: string;
  titleFr: string;
  titleEn: string;
  shortFr: string;
  shortEn: string;
  labelFr: string;
  labelEn: string;
  guideHref: string;
};

export const MATCHA_INTENT_SUMMARIES: MatchaIntentSummary[] = [
  {
    tag: "usucha",
    href: "/matcha-usucha",
    titleFr: "Matcha usucha japonais",
    titleEn: "Japanese matcha for usucha",
    shortFr:
      "Des matchas pensés pour être fouettés à l’eau : équilibre, douceur et expression aromatique.",
    shortEn:
      "Matcha selected for whisking with water: balance, gentleness and aromatic expression.",
    labelFr: "Usucha",
    labelEn: "Usucha",
    guideHref: "/guides/usucha-vs-koicha",
  },
  {
    tag: "koicha",
    href: "/matcha-koicha",
    titleFr: "Matcha koicha japonais",
    titleEn: "Japanese matcha for koicha",
    shortFr:
      "Une sélection pour le thé épais, où douceur, umami et faible astringence deviennent essentiels.",
    shortEn:
      "A selection for thick tea, where gentleness, umami and low astringency become essential.",
    labelFr: "Koicha",
    labelEn: "Koicha",
    guideHref: "/guides/usucha-vs-koicha",
  },
  {
    tag: "latte",
    href: "/matcha-latte",
    titleFr: "Matcha japonais pour latte",
    titleEn: "Japanese matcha for latte",
    shortFr:
      "Des profils assez présents pour rester expressifs avec le lait, sans payer uniquement pour des nuances masquées.",
    shortEn:
      "Profiles with enough presence to remain expressive with milk, without paying only for nuances that get masked.",
    labelFr: "Latte",
    labelEn: "Latte",
    guideHref: "/guides/matcha-ceremonie-vs-latte",
  },
  {
    tag: "ceremonial",
    href: "/matcha-ceremonie",
    titleFr: "Matcha cérémonie japonais",
    titleEn: "Japanese ceremonial matcha",
    shortFr:
      "Une sélection orientée dégustation à l’eau, avec une lecture transparente du terme « cérémonie ».",
    shortEn:
      "A water-focused tasting selection with transparent context around the word “ceremonial”.",
    labelFr: "Cérémonie",
    labelEn: "Ceremonial",
    guideHref: "/guides/matcha-ceremonie-vs-latte",
  },
];

export function getMatchaIntentSummary(
  tag: MatchaIntentSummary["tag"],
) {
  return MATCHA_INTENT_SUMMARIES.find((page) => page.tag === tag) ?? null;
}

export type MatchaIntentSettings = Record<string, string>;

export function matchaIntentSettingPrefix(tag: MatchaIntentSummary["tag"]) {
  return `matcha_${tag}`;
}

function configuredIntentValue(
  settings: MatchaIntentSettings,
  key: string,
  fallback: string,
) {
  if (!Object.prototype.hasOwnProperty.call(settings, key)) return fallback;
  return settings[key] ?? fallback;
}

export function configureMatchaIntentSummary(
  summary: MatchaIntentSummary,
  settings: MatchaIntentSettings,
): MatchaIntentSummary {
  const prefix = matchaIntentSettingPrefix(summary.tag);
  return {
    ...summary,
    labelFr: configuredIntentValue(settings, `${prefix}_label_fr`, summary.labelFr),
    labelEn: configuredIntentValue(settings, `${prefix}_label_en`, summary.labelEn),
    titleFr: configuredIntentValue(settings, `${prefix}_title_fr`, summary.titleFr),
    titleEn: configuredIntentValue(settings, `${prefix}_title_en`, summary.titleEn),
    shortFr: configuredIntentValue(settings, `${prefix}_short_fr`, summary.shortFr),
    shortEn: configuredIntentValue(settings, `${prefix}_short_en`, summary.shortEn),
  };
}

export function matchaIntentVisible(
  summary: MatchaIntentSummary,
  settings: MatchaIntentSettings,
) {
  return settings[`${matchaIntentSettingPrefix(summary.tag)}_visible`] !== "false";
}
