import { auditProductContent, sanitizeStorefrontProductText } from "@/lib/product-content";
import { productMatchaFinderTags, type MatchaFinderTag } from "@/lib/product-merchandising";
import { settingEnabled, type SiteSettings } from "@/lib/settings";
import type { Category, Product } from "@/lib/types";

export type SeoHealthLevel = "error" | "warning";
export type SeoHealthStatus = "error" | "warning" | "ready";

export type SeoHealthIssue = {
  code: string;
  level: SeoHealthLevel;
  label: string;
};

export type SeoHealthReviewSignal = {
  count: number;
  average: number;
  schemaEligible: boolean;
};

export type SeoHealthProductRow = {
  id: string;
  name: string;
  path: string;
  categoryName: string;
  categoryPath: string | null;
  score: number;
  status: SeoHealthStatus;
  issues: SeoHealthIssue[];
  signals: {
    titleLength: number;
    descriptionLength: number;
    hasImage: boolean;
    offerCount: number;
    finderTags: MatchaFinderTag[];
    review: SeoHealthReviewSignal;
  };
};

export type SeoHealthGlobalCheck = {
  id: string;
  status: "ok" | "warning" | "error";
  label: string;
  detail: string;
};

export type SeoHealthReport = {
  score: number;
  summary: {
    products: number;
    ready: number;
    warning: number;
    error: number;
    issues: number;
    reviewSchemaEligible: number;
  };
  globalChecks: SeoHealthGlobalCheck[];
  rows: SeoHealthProductRow[];
};

export type SeoHealthReviewTotals = Record<
  string,
  { count: number; total: number }
>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function normalizedSlug(value: unknown) {
  return text(value).toLocaleLowerCase("fr-FR");
}

function cleanSlug(value: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function publicProductPath(product: Product) {
  return `/boutique/${encodeURIComponent(normalizedSlug(product.slug))}`;
}

function categoryPath(category: Category) {
  return `/boutique/categorie/${encodeURIComponent(
    normalizedSlug(category.slug),
  )}`;
}

function seoDescription(product: Product) {
  for (const candidate of [
    product.description_fr,
    product.description_en,
    product.long_description_fr,
    product.long_description_en,
  ]) {
    const value = sanitizeStorefrontProductText(candidate);
    if (value) return value;
  }
  return "";
}

function hasProductImage(product: Product) {
  return Boolean(text(product.images?.[0]?.url) || text(product.image_url));
}

function offerHealth(product: Product) {
  const variants = product.variants.filter((variant) => variant.active);
  if (variants.length) {
    const valid = variants.every(
      (variant) =>
        Number.isFinite(Number(variant.price)) &&
        Number(variant.price) >= 0,
    );
    return { count: variants.length, valid };
  }

  return {
    count: 1,
    valid:
      Number.isFinite(Number(product.base_price)) &&
      Number(product.base_price) >= 0,
  };
}

function slugCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function reviewSignal(
  productId: string,
  totals: SeoHealthReviewTotals,
  settings: SiteSettings,
): SeoHealthReviewSignal {
  const value = totals[productId] ?? { count: 0, total: 0 };
  const count = Math.max(0, Number(value.count) || 0);
  const average = count
    ? Math.round((Number(value.total || 0) / count) * 10) / 10
    : 0;
  const schemaEligible =
    settingEnabled(settings.shop_reviews_enabled) &&
    settingEnabled(settings.shop_reviews_show_rating) &&
    count > 0;

  return { count, average, schemaEligible };
}

export function buildSeoHealthReport({
  products,
  categories,
  reviewTotals,
  settings,
}: {
  products: Product[];
  categories: Category[];
  reviewTotals: SeoHealthReviewTotals;
  settings: SiteSettings;
}): SeoHealthReport {
  const categoryById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const productSlugCounts = slugCounts(
    products.map((product) => normalizedSlug(product.slug)),
  );
  const categorySlugCounts = slugCounts(
    categories.map((category) => normalizedSlug(category.slug)),
  );

  const rows = products.map<SeoHealthProductRow>((product) => {
    const issues: SeoHealthIssue[] = [];
    const add = (
      code: string,
      level: SeoHealthLevel,
      label: string,
    ) => issues.push({ code, level, label });

    const productSlug = normalizedSlug(product.slug);
    const title = text(product.name_fr);
    const description = seoDescription(product);
    const category = categoryById.get(product.category_id) ?? null;
    const finderTags = productMatchaFinderTags(product);
    const offer = offerHealth(product);
    const review = reviewSignal(product.id, reviewTotals, settings);

    if (!productSlug) {
      add("slug_missing", "error", "Slug produit manquant");
    } else {
      if (!cleanSlug(productSlug)) {
        add(
          "slug_format",
          "warning",
          "Slug non standard : utiliser lettres minuscules, chiffres et tirets",
        );
      }
      if ((productSlugCounts.get(productSlug) ?? 0) > 1) {
        add("slug_duplicate", "error", "Slug produit dupliqué");
      }
    }

    if (!title) {
      add("title_missing", "error", "Nom FR / title SEO manquant");
    } else if (title.length > 65) {
      add(
        "title_long",
        "warning",
        "Title SEO long : risque de troncature dans les résultats",
      );
    }

    if (!description) {
      add(
        "description_missing",
        "error",
        "Aucune description disponible pour la meta description",
      );
    } else {
      if (description.length < 70) {
        add(
          "description_short",
          "warning",
          "Meta description courte : moins de 70 caractères",
        );
      }
      if (description.length > 180) {
        add(
          "description_long",
          "warning",
          "Meta description longue : plus de 180 caractères",
        );
      }
    }

    if (!hasProductImage(product)) {
      add(
        "image_missing",
        "warning",
        "Image produit absente : le placeholder public sera utilisé",
      );
    }

    if (!offer.valid) {
      add(
        "offer_invalid",
        "error",
        "Prix invalide dans les données Offer du produit",
      );
    }

    if (!category) {
      add(
        "category_missing",
        "error",
        "Catégorie Boutique active introuvable",
      );
    } else {
      const categorySlug = normalizedSlug(category.slug);
      if (!categorySlug) {
        add(
          "category_slug_missing",
          "error",
          "Slug de collection manquant",
        );
      } else {
        if (!cleanSlug(categorySlug)) {
          add(
            "category_slug_format",
            "warning",
            "Slug de collection non standard",
          );
        }
        if ((categorySlugCounts.get(categorySlug) ?? 0) > 1) {
          add(
            "category_slug_duplicate",
            "error",
            "Slug de collection dupliqué",
          );
        }
      }
    }

    if (product.type === "product" && !finderTags.length) {
      add(
        "intent_links_missing",
        "warning",
        "Aucun tag d’usage : pas de liaison produit → landing Usucha/Koicha/Latte/Cérémonie",
      );
    }

    for (const issue of auditProductContent({
      kind: "shop",
      type: product.type,
      description_fr: product.description_fr,
      description_en: product.description_en,
      long_description_fr: product.long_description_fr,
      long_description_en: product.long_description_en,
      origin: product.origin,
      cultivar: product.cultivar,
      ideal_for: product.ideal_for,
    })) {
      add(`content_${issue.code}`, issue.level, issue.label);
    }

    const errors = issues.filter((issue) => issue.level === "error").length;
    const warnings = issues.length - errors;
    const score = Math.max(0, 100 - errors * 18 - warnings * 5);
    const status: SeoHealthStatus = errors
      ? "error"
      : warnings
        ? "warning"
        : "ready";

    return {
      id: product.id,
      name: title || product.name_en || "Produit sans nom",
      path: publicProductPath(product),
      categoryName: category?.name_fr || "Sans catégorie",
      categoryPath: category ? categoryPath(category) : null,
      score,
      status,
      issues,
      signals: {
        titleLength: title.length,
        descriptionLength: description.length,
        hasImage: hasProductImage(product),
        offerCount: offer.count,
        finderTags,
        review,
      },
    };
  });

  rows.sort(
    (a, b) =>
      (a.status === "error" ? 0 : a.status === "warning" ? 1 : 2) -
        (b.status === "error" ? 0 : b.status === "warning" ? 1 : 2) ||
      a.score - b.score ||
      a.name.localeCompare(b.name, "fr"),
  );

  const duplicateProductSlugs = [...productSlugCounts.values()].filter(
    (count) => count > 1,
  ).length;
  const duplicateCategorySlugs = [...categorySlugCounts.values()].filter(
    (count) => count > 1,
  ).length;
  const seoTitle = text(settings.seo_title);
  const seoDescriptionValue = text(settings.seo_description);
  const reviewSchemaEligible = rows.filter(
    (row) => row.signals.review.schemaEligible,
  ).length;

  const globalChecks: SeoHealthGlobalCheck[] = [
    {
      id: "homepage_metadata",
      status: seoTitle && seoDescriptionValue ? "ok" : "error",
      label: "Metadata accueil",
      detail:
        seoTitle && seoDescriptionValue
          ? `${seoTitle.length} car. title · ${seoDescriptionValue.length} car. description`
          : "seo_title ou seo_description manque dans les réglages.",
    },
    {
      id: "canonical_products",
      status: duplicateProductSlugs ? "error" : "ok",
      label: "Canonicals produits",
      detail: duplicateProductSlugs
        ? `${duplicateProductSlugs} slug(s) produit dupliqué(s).`
        : `${products.length} URL(s) produit distincte(s).`,
    },
    {
      id: "canonical_collections",
      status: duplicateCategorySlugs ? "error" : "ok",
      label: "Collections Boutique",
      detail: duplicateCategorySlugs
        ? `${duplicateCategorySlugs} slug(s) collection dupliqué(s).`
        : `${categories.length} collection(s) canonique(s) active(s).`,
    },
    {
      id: "local_seo",
      status:
        text(settings.store_address) && text(settings.opening_hours)
          ? "ok"
          : "warning",
      label: "SEO local Nice",
      detail:
        text(settings.store_address) && text(settings.opening_hours)
          ? "Adresse et horaires publics sont renseignés."
          : "Adresse ou horaires manquent dans les réglages publics.",
    },
    {
      id: "review_schema",
      status: "ok",
      label: "Avis structurés",
      detail:
        settingEnabled(settings.shop_reviews_enabled) &&
        settingEnabled(settings.shop_reviews_show_rating)
          ? `${reviewSchemaEligible} produit(s) actuellement éligible(s) à AggregateRating.`
          : "Avis ou notes désactivés : AggregateRating est volontairement omis.",
    },
  ];

  const ready = rows.filter((row) => row.status === "ready").length;
  const warning = rows.filter((row) => row.status === "warning").length;
  const error = rows.filter((row) => row.status === "error").length;
  const issues = rows.reduce((sum, row) => sum + row.issues.length, 0);
  const score = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length)
    : 100;

  return {
    score,
    summary: {
      products: rows.length,
      ready,
      warning,
      error,
      issues,
      reviewSchemaEligible,
    },
    globalChecks,
    rows,
  };
}
