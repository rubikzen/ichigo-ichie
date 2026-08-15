type Language = "fr" | "en";

export type ProductVariantLabelInput = {
  name?: string | null;
  packaging?: string | null;
  weight?: string | null;
};

function normalized(value?: string | null) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function packagingKind(value?: string | null): "can" | "bag" | "" {
  const key = normalized(value);
  if (["can", "tin", "boite"].includes(key)) return "can";
  if (["bag", "pouch", "sachet"].includes(key)) return "bag";
  return "";
}

export function packagingLabel(packaging: string | null | undefined, language: Language) {
  const kind = packagingKind(packaging);
  if (kind === "can") return language === "fr" ? "Boîte" : "Tin";
  if (kind === "bag") return language === "fr" ? "Sachet" : "Pouch";
  return language === "fr" ? "Autre" : "Other";
}

function nameDuplicatesPackaging(variant: ProductVariantLabelInput) {
  const nameKind = packagingKind(variant.name);
  const packaging = packagingKind(variant.packaging);
  return Boolean(nameKind && packaging && nameKind === packaging);
}

export function variantLabel(variant: ProductVariantLabelInput) {
  const weight = String(variant.weight ?? "").trim();
  const rawName = String(variant.name ?? "").trim();
  const name = nameDuplicatesPackaging(variant) ? "" : rawName;

  if (weight && name && normalized(weight) !== normalized(name)) return `${name} · ${weight}`;
  return weight || name || rawName || "Format";
}

export function productVariantLabel(variant: ProductVariantLabelInput, language: Language) {
  const packaging = packagingKind(variant.packaging) ? packagingLabel(variant.packaging, language) : "";
  const weight = String(variant.weight ?? "").trim();
  const detail = nameDuplicatesPackaging(variant) && !weight ? "" : variantLabel(variant);
  return uniqueLabels([packaging, detail].filter(Boolean)).join(" · ");
}

export function composeProductVariantName(
  baseName: string,
  variant: ProductVariantLabelInput | null | undefined,
  language: Language,
) {
  const base = String(baseName || "").trim();
  if (!variant) return base;
  const detail = productVariantLabel(variant, language);
  return detail ? `${base} · ${detail}` : base;
}

/**
 * Cleans labels already stored in localStorage / historical orders.
 * Only complete separator-delimited packaging aliases are collapsed, so normal
 * product or variant words are never rewritten.
 */
export function normalizeLegacyProductLabel(value: string, language: Language) {
  const parts = String(value || "").split("·").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return String(value || "").trim();

  const result = [parts[0]];
  let seenPackaging: "can" | "bag" | "" = "";

  for (const part of parts.slice(1)) {
    const kind = packagingKind(part);
    if (kind) {
      if (seenPackaging === kind) continue;
      seenPackaging = kind;
      result.push(packagingLabel(kind, language));
      continue;
    }
    if (!result.some((existing) => normalized(existing) === normalized(part))) result.push(part);
  }

  return result.join(" · ");
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = normalized(label);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
