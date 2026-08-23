import type {
  FoodInformation,
  Product,
  Variant,
} from "@/lib/types";
import { productPublicSlug } from "@/lib/product-url";

export type CommercialIssueLevel = "error" | "warning";

export type CommercialIssue = {
  code: string;
  level: CommercialIssueLevel;
  label: string;
  productId?: string;
  productName?: string;
  area: "catalog" | "site";
  section: "products" | "settings";
};

export type FoodCommercialPreflight = {
  required: boolean;
  blockers: CommercialIssue[];
  warnings: CommercialIssue[];
  resolvedNetQuantity: string;
};

type FoodProductInput = Pick<
  Product,
  "id" | "type" | "name_fr" | "origin" | "food_info"
>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizedFoodInformation(
  value: FoodInformation | null | undefined,
): FoodInformation {
  return value && typeof value === "object" ? value : {};
}

function productIssue(
  product: FoodProductInput,
  code: string,
  level: CommercialIssueLevel,
  label: string,
): CommercialIssue {
  return {
    code,
    level,
    label,
    productId: product.id,
    productName: product.name_fr,
    area: "catalog",
    section: "products",
  };
}

function activeVariantWeights(variants: Variant[]) {
  return [
    ...new Set(
      variants
        .filter((variant) => variant.active)
        .map((variant) => text(variant.weight))
        .filter(Boolean),
    ),
  ];
}

export function foodCommercialPreflight(
  product: FoodProductInput,
  variants: Variant[],
): FoodCommercialPreflight {
  if (product.type !== "product") {
    return {
      required: false,
      blockers: [],
      warnings: [],
      resolvedNetQuantity: "",
    };
  }

  const food = normalizedFoodInformation(product.food_info);
  const blockers: CommercialIssue[] = [];
  const warnings: CommercialIssue[] = [];
  const requireField = (
    key: keyof FoodInformation,
    code: string,
    label: string,
  ) => {
    if (!text(food[key])) {
      blockers.push(productIssue(product, code, "error", label));
    }
  };

  requireField(
    "legal_name_fr",
    "food_legal_name_missing",
    "Dénomination légale FR manquante",
  );
  requireField(
    "ingredients_fr",
    "food_ingredients_missing",
    "Liste des ingrédients FR manquante",
  );
  requireField(
    "allergens_fr",
    "food_allergens_missing",
    "Information allergènes FR manquante",
  );
  requireField(
    "storage_fr",
    "food_storage_missing",
    "Conditions de conservation FR manquantes",
  );
  requireField(
    "operator_fr",
    "food_operator_missing",
    "Opérateur responsable / adresse FR manquant",
  );

  if (!text(product.origin)) {
    blockers.push(
      productIssue(
        product,
        "food_origin_missing",
        "error",
        "Origine / provenance à renseigner",
      ),
    );
  }

  const variantWeights = activeVariantWeights(variants);
  const resolvedNetQuantity =
    text(food.net_quantity) ||
    (variantWeights.length ? variantWeights.join(" · ") : "");

  if (!resolvedNetQuantity) {
    blockers.push(
      productIssue(
        product,
        "food_net_quantity_missing",
        "error",
        "Quantité nette manquante (ou poids de variante)",
      ),
    );
  }

  const englishFields: Array<[keyof FoodInformation, string]> = [
    ["legal_name_en", "dénomination"],
    ["ingredients_en", "ingrédients"],
    ["allergens_en", "allergènes"],
    ["storage_en", "conservation"],
    ["operator_en", "opérateur"],
  ];
  const missingEnglish = englishFields
    .filter(([key]) => !text(food[key]))
    .map(([, label]) => label);

  if (missingEnglish.length) {
    warnings.push(
      productIssue(
        product,
        "food_english_incomplete",
        "warning",
        `Version EN incomplète : ${missingEnglish.join(", ")}`,
      ),
    );
  }

  if (!text(food.preparation_fr)) {
    warnings.push(
      productIssue(
        product,
        "food_preparation_missing",
        "warning",
        "Conseils d’utilisation / préparation FR non renseignés",
      ),
    );
  }

  return {
    required: true,
    blockers,
    warnings,
    resolvedNetQuantity,
  };
}

function simpleIssue(
  code: string,
  level: CommercialIssueLevel,
  label: string,
  area: "catalog" | "site",
  section: "products" | "settings",
  product?: Pick<Product, "id" | "name_fr">,
): CommercialIssue {
  return {
    code,
    level,
    label,
    area,
    section,
    ...(product
      ? { productId: product.id, productName: product.name_fr }
      : {}),
  };
}

function normalizedComparableCopy(value: unknown) {
  return text(value)
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'");
}

const PLACEHOLDER_RE =
  /(?:\[\s*(?:à|a)\s+compl[eé]ter\s*\]|complete this section|complete before public launch|before public launch|avant la mise en ligne publique|compl[eé]tez ici les d[eé]lais indicatifs)/i;

function firstPublishedEmail(values: string[]) {
  for (const value of values) {
    const match = value.match(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    );
    if (match?.[0]) return match[0];
  }
  return "";
}

export function buildCommercialLaunchReport({
  products,
  variants,
  settings,
}: {
  products: Product[];
  variants: Variant[];
  settings: Record<string, string>;
}) {
  const issues: CommercialIssue[] = [];
  const activeProducts = products.filter((product) => product.active);
  const variantsByProduct = new Map<string, Variant[]>();

  for (const variant of variants) {
    variantsByProduct.set(variant.product_id, [
      ...(variantsByProduct.get(variant.product_id) ?? []),
      variant,
    ]);
  }

  let blockedFoodProducts = 0;

  for (const product of activeProducts) {
    const food = foodCommercialPreflight(
      product,
      variantsByProduct.get(product.id) ?? [],
    );
    if (food.blockers.length) blockedFoodProducts += 1;
    issues.push(...food.blockers, ...food.warnings);

    const publicIdentity =
      `${product.name_fr} ${product.name_en}`.toLocaleLowerCase("fr");
    if (/(^|\W)(test|copie|copy)(\W|$)/i.test(publicIdentity)) {
      issues.push(
        simpleIssue(
          "catalog_test_copy_active",
          "error",
          "Produit actif avec un nom public de test ou copie",
          "catalog",
          "products",
          product,
        ),
      );
    }

    if (Number(product.base_price) > 0 && Number(product.base_price) <= 1) {
      issues.push(
        simpleIssue(
          "catalog_suspicious_price",
          "warning",
          `Prix inhabituellement bas : ${Number(product.base_price).toFixed(2)} €`,
          "catalog",
          "products",
          product,
        ),
      );
    }

    if (!text(product.image_url) && !(product.images ?? []).length) {
      issues.push(
        simpleIssue(
          "catalog_image_missing",
          "warning",
          "Aucune image produit",
          "catalog",
          "products",
          product,
        ),
      );
    }
  }

  const productsByPublicSlug = new Map<string, Product[]>();
  for (const product of activeProducts) {
    const publicSlug = productPublicSlug(product);
    productsByPublicSlug.set(publicSlug, [
      ...(productsByPublicSlug.get(publicSlug) ?? []),
      product,
    ]);
  }

  for (const [publicSlug, owners] of productsByPublicSlug) {
    if (owners.length < 2) continue;
    for (const product of owners) {
      issues.push(
        simpleIssue(
          "catalog_public_slug_collision",
          "error",
          `URL publique en conflit : /boutique/${publicSlug}`,
          "catalog",
          "products",
          product,
        ),
      );
    }
  }

  const seenDescription = new Map<string, Product>();
  for (const product of activeProducts) {
    const copy = normalizedComparableCopy(
      product.long_description_fr || product.description_fr,
    );
    if (copy.length < 40) continue;
    const previous = seenDescription.get(copy);
    if (previous && previous.id !== product.id) {
      issues.push(
        simpleIssue(
          "catalog_duplicate_description",
          "warning",
          `Description identique à « ${previous.name_fr} »`,
          "catalog",
          "products",
          product,
        ),
      );
    } else {
      seenDescription.set(copy, product);
    }
  }

  const legalFields = [
    ["legal_notice_body_fr", "Mentions légales"],
    ["terms_body_fr", "CGV"],
    ["privacy_body_fr", "Confidentialité"],
    ["shipping_returns_body_fr", "Livraison & retours"],
  ] as const;

  for (const [key, label] of legalFields) {
    const value = text(settings[key]);
    if (!value || PLACEHOLDER_RE.test(value)) {
      issues.push(
        simpleIssue(
          `legal_${key}_placeholder`,
          "error",
          `${label} contient encore un texte à compléter`,
          "site",
          "settings",
        ),
      );
    }
    if (/ichigo-ichie\.store/i.test(value)) {
      issues.push(
        simpleIssue(
          `legal_${key}_old_domain`,
          "error",
          `${label} contient encore l’ancien domaine ichigo-ichie.store`,
          "site",
          "settings",
        ),
      );
    }
  }

  const terms = text(settings.terms_body_fr);
  if (terms && !/m[eé]diat/i.test(terms)) {
    issues.push(
      simpleIssue(
        "legal_mediation_missing",
        "error",
        "CGV : informations de médiation non détectées",
        "site",
        "settings",
      ),
    );
  }

  const publishedSupportEmail =
    text(settings.support_email) ||
    firstPublishedEmail(
      legalFields.map(([key]) => text(settings[key])),
    );

  if (!publishedSupportEmail) {
    issues.push(
      simpleIssue(
        "legal_support_email_missing",
        "warning",
        "E-mail de contact support non renseigné",
        "site",
        "settings",
      ),
    );
  }

  const blockers = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");

  return {
    status: blockers.length ? "blocked" : warnings.length ? "review" : "ready",
    summary: {
      blockers: blockers.length,
      warnings: warnings.length,
      activeProducts: activeProducts.length,
      blockedFoodProducts,
    },
    issues,
  };
}
