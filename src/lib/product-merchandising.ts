import type { Product } from "@/lib/types";

export const MATCHA_FINDER_TAGS = ["daily", "ceremonial", "usucha", "koicha", "latte"] as const;
export type MatchaFinderTag = (typeof MATCHA_FINDER_TAGS)[number];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

export function productMatchaFinderTags(product: Product): MatchaFinderTag[] {
  if (product.type !== "product") return [];
  const idealFor = Array.isArray(product.ideal_for)
    ? product.ideal_for.map((item) => normalize(String(item))).join(" ")
    : "";
  const editorial = normalize([
    product.badge || "",
    product.description_fr || "",
    product.description_en || "",
    product.long_description_fr || "",
    product.long_description_en || "",
  ].join(" "));
  const tags = new Set<MatchaFinderTag>();
  if (includesAny(idealFor, ["daily", "everyday", "quotidien", "quotidienne"])) tags.add("daily");
  if (includesAny(editorial, ["ceremonial", "ceremonie", "ceremony"])) tags.add("ceremonial");
  if (idealFor.includes("usucha")) tags.add("usucha");
  if (idealFor.includes("koicha")) tags.add("koicha");
  if (idealFor.includes("latte")) tags.add("latte");
  return MATCHA_FINDER_TAGS.filter((tag) => tags.has(tag));
}

export function productMatchesFinderTag(product: Product, tag: "all" | MatchaFinderTag) {
  return tag === "all" || productMatchaFinderTags(product).includes(tag);
}

export function matchaFinderLabel(tag: MatchaFinderTag, language: "fr" | "en") {
  const labels: Record<MatchaFinderTag, { fr: string; en: string }> = {
    daily: { fr: "Quotidien", en: "Daily" },
    ceremonial: { fr: "Cérémonie", en: "Ceremonial" },
    usucha: { fr: "Usucha", en: "Usucha" },
    koicha: { fr: "Koicha", en: "Koicha" },
    latte: { fr: "Latte", en: "Latte" },
  };
  return labels[tag][language];
}
