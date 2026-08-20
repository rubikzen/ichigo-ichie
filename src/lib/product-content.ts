const SUPPLIER_SHIPPING_MARKERS = [
  "[important notice regarding international shipping]",
  "important notice regarding international shipping",
  "dhl duty & tax calculator",
  "simplyduty",
] as const;

export function sanitizeStorefrontProductText(
  value: string | null | undefined,
) {
  const raw = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return "";

  const normalized = raw.toLowerCase();
  const cutAt = SUPPLIER_SHIPPING_MARKERS.reduce((earliest, marker) => {
    const index = normalized.indexOf(marker);
    if (index < 0) return earliest;
    return earliest < 0 ? index : Math.min(earliest, index);
  }, -1);

  const customerCopy = cutAt >= 0 ? raw.slice(0, cutAt) : raw;
  return customerCopy.replace(/\n{3,}/g, "\n\n").trim();
}

export function hasSupplierShippingBoilerplate(
  value: string | null | undefined,
) {
  const normalized = String(value ?? "").toLowerCase();
  return SUPPLIER_SHIPPING_MARKERS.some((marker) =>
    normalized.includes(marker),
  );
}


export type EditorialLanguage = "fr" | "en" | "unknown";

export type ProductContentQualityIssue = {
  code: string;
  level: "error" | "warning";
  label: string;
};

export type ProductContentQualityInput = {
  kind?: "menu" | "shop";
  type?: string | null;
  description_fr?: string | null;
  description_en?: string | null;
  long_description_fr?: string | null;
  long_description_en?: string | null;
  origin?: string | null;
  cultivar?: string | null;
  ideal_for?: string[] | null;
};

const ENGLISH_LANGUAGE_MARKERS = [
  " the ",
  " and ",
  " with ",
  " from ",
  " this ",
  " that ",
  " is ",
  " are ",
  " of ",
  " to ",
  " in ",
] as const;

const FRENCH_LANGUAGE_MARKERS = [
  " le ",
  " la ",
  " les ",
  " des ",
  " avec ",
  " pour ",
  " ce ",
  " cette ",
  " est ",
  " sont ",
  " de ",
  " du ",
  " dans ",
  " une ",
  " un ",
] as const;

function languageMarkerScore(value: string, markers: readonly string[]) {
  return markers.reduce(
    (score, marker) => score + (value.includes(marker) ? 1 : 0),
    0,
  );
}

export function detectEditorialLanguage(
  value: string | null | undefined,
): EditorialLanguage {
  const text = sanitizeStorefrontProductText(value);
  if (text.length < 40) return "unknown";

  const normalized = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  let frenchScore = languageMarkerScore(normalized, FRENCH_LANGUAGE_MARKERS);
  const englishScore = languageMarkerScore(normalized, ENGLISH_LANGUAGE_MARKERS);

  if (/[àâçéèêëîïôùûüÿœ]/i.test(text)) frenchScore += 2;

  if (englishScore >= 3 && englishScore >= frenchScore + 2) return "en";
  if (frenchScore >= 3 && frenchScore >= englishScore + 2) return "fr";
  return "unknown";
}

export function normalizeEditorialText(
  value: string | null | undefined,
) {
  return sanitizeStorefrontProductText(value)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function normalizeIdealFor(
  values: string[] | null | undefined,
) {
  const seen = new Set<string>();

  return (values ?? []).reduce<string[]>((rows, value) => {
    const clean = String(value ?? "").trim().replace(/\s+/g, " ");
    if (!clean) return rows;

    const key = clean.toLocaleLowerCase("fr");
    if (seen.has(key)) return rows;
    seen.add(key);
    rows.push(clean);
    return rows;
  }, []);
}

function isEditorialFallbackCopy(
  value: string,
  candidates: Array<string | null | undefined>,
) {
  if (!value) return false;
  return candidates.some(
    (candidate) =>
      Boolean(candidate) &&
      normalizeEditorialText(candidate) === value,
  );
}

export function auditProductContent(
  product: ProductContentQualityInput,
): ProductContentQualityIssue[] {
  const issues: ProductContentQualityIssue[] = [];
  const shortFr = normalizeEditorialText(product.description_fr);
  const shortEn = normalizeEditorialText(product.description_en);
  const longFr = normalizeEditorialText(product.long_description_fr);
  const longEn = normalizeEditorialText(product.long_description_en);
  const idealFor = normalizeIdealFor(product.ideal_for);

  const add = (
    code: string,
    level: ProductContentQualityIssue["level"],
    label: string,
  ) => issues.push({ code, level, label });

  if (!shortFr) {
    add("short_fr_missing", "error", "Description courte FR manquante");
  } else if (detectEditorialLanguage(shortFr) === "en") {
    add(
      "short_fr_likely_en",
      "warning",
      "Description courte FR probablement en anglais",
    );
  }

  if (
    shortEn &&
    detectEditorialLanguage(shortEn) === "fr" &&
    !isEditorialFallbackCopy(shortEn, [shortFr])
  ) {
    add(
      "short_en_likely_fr",
      "warning",
      "Description courte EN probablement en français",
    );
  }

  if (longFr && detectEditorialLanguage(longFr) === "en") {
    add(
      "long_fr_likely_en",
      "warning",
      "Description complète FR probablement en anglais",
    );
  }

  if (
    longEn &&
    detectEditorialLanguage(longEn) === "fr" &&
    !isEditorialFallbackCopy(longEn, [longFr, shortFr, shortEn])
  ) {
    add(
      "long_en_likely_fr",
      "warning",
      "Description complète EN probablement en français",
    );
  }

  if (
    [
      product.description_fr,
      product.description_en,
      product.long_description_fr,
      product.long_description_en,
    ].some(hasSupplierShippingBoilerplate)
  ) {
    add(
      "supplier_boilerplate",
      "warning",
      "Texte fournisseur / livraison internationale à nettoyer",
    );
  }

  if (product.kind === "shop") {
    if (product.type === "product") {
      if (!String(product.origin ?? "").trim()) {
        add("origin_missing", "warning", "Origine manquante");
      }

      if (!idealFor.length) {
        add("ideal_for_missing", "warning", "Usage « Idéal pour » manquant");
      }

      if (!longFr || longFr === shortFr) {
        add(
          "long_fr_missing",
          "warning",
          "Description complète FR à enrichir",
        );
      }
    }

    if ((product.ideal_for ?? []).length !== idealFor.length) {
      add(
        "ideal_for_cleanup",
        "warning",
        "« Idéal pour » contient des doublons ou valeurs vides",
      );
    }
  }

  return issues;
}


const SAFE_CONTENT_FIX_CODES = new Set([
  "supplier_boilerplate",
  "ideal_for_cleanup",
  "long_en_likely_fr",
]);

export function safeContentFixCount(
  product: ProductContentQualityInput,
) {
  return auditProductContent(product).filter((issue) =>
    SAFE_CONTENT_FIX_CODES.has(issue.code),
  ).length;
}

export function applySafeContentQualityFixes(
  product: ProductContentQualityInput,
) {
  const issueCodes = new Set(
    auditProductContent(product).map((issue) => issue.code),
  );

  const shortFr = normalizeEditorialText(product.description_fr);
  const shortEn = normalizeEditorialText(product.description_en);
  const longFr = normalizeEditorialText(product.long_description_fr);
  const longEn = normalizeEditorialText(product.long_description_en);

  return {
    description_fr: shortFr,
    description_en: shortEn,
    long_description_fr: longFr,
    long_description_en: issueCodes.has("long_en_likely_fr")
      ? shortEn || shortFr
      : longEn,
    ideal_for: normalizeIdealFor(product.ideal_for),
  };
}


export type ProductContentCompletionStatus = "ready" | "fallback" | "review";

export type ProductContentCompletionStep = {
  id: string;
  label: string;
  status: ProductContentCompletionStatus;
  detail: string;
};

export function productContentCompletion(
  product: ProductContentQualityInput,
) {
  const issues = auditProductContent(product);
  const issueCodes = new Set(issues.map((issue) => issue.code));
  const shortEn = normalizeEditorialText(product.description_en);
  const longFr = normalizeEditorialText(product.long_description_fr);
  const longEn = normalizeEditorialText(product.long_description_en);
  const isMatchaProduct = product.kind === "shop" && product.type === "product";
  const steps: ProductContentCompletionStep[] = [];

  const addStep = (
    id: string,
    label: string,
    status: ProductContentCompletionStatus,
    detail: string,
  ) => steps.push({ id, label, status, detail });

  addStep(
    "short_fr",
    "Texte court FR",
    issueCodes.has("short_fr_missing") || issueCodes.has("short_fr_likely_en") ? "review" : "ready",
    "Texte principal de la carte Boutique.",
  );

  addStep(
    "short_en",
    "Texte court EN",
    issueCodes.has("short_en_likely_fr") ? "review" : shortEn ? "ready" : "fallback",
    shortEn ? "Version anglaise renseignée." : "Fallback FR accepté si EN reste vide.",
  );

  if (isMatchaProduct) {
    addStep(
      "long_fr",
      "Fiche complète FR",
      issueCodes.has("long_fr_missing") || issueCodes.has("long_fr_likely_en") ? "review" : "ready",
      "Description enrichie de la fiche produit.",
    );
    addStep(
      "long_en",
      "Fiche complète EN",
      issueCodes.has("long_en_likely_fr") ? "review" : longEn ? "ready" : "fallback",
      longEn ? "Version anglaise renseignée." : "Fallback du texte court accepté.",
    );
    addStep(
      "origin",
      "Origine",
      issueCodes.has("origin_missing") ? "review" : "ready",
      "Origine commerciale vérifiée du matcha.",
    );
    addStep(
      "ideal_for",
      "Idéal pour",
      issueCodes.has("ideal_for_missing") || issueCodes.has("ideal_for_cleanup") ? "review" : "ready",
      "Usages recommandés renseignés sans doublon.",
    );
  } else {
    if (longFr && issueCodes.has("long_fr_likely_en")) {
      addStep("long_fr", "Texte long FR", "review", "Le texte long FR semble être en anglais.");
    }
    if (longEn && issueCodes.has("long_en_likely_fr")) {
      addStep("long_en", "Texte long EN", "review", "Le texte long EN semble être en français.");
    }
  }

  if (issueCodes.has("supplier_boilerplate")) {
    addStep(
      "supplier_cleanup",
      "Nettoyage fournisseur",
      "review",
      "Retirer les mentions fournisseur ou livraison internationale.",
    );
  }

  const completedCount = steps.filter((step) => step.status !== "review").length;
  const totalCount = steps.length;
  const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 100;

  return { steps, completedCount, totalCount, percent, issueCount: issues.length };
}
