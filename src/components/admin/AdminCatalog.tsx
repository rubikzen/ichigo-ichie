"use client";

import { useState } from "react";
import { ProductGalleryAdmin } from "../ProductGalleryAdmin";
import { SafeImage } from "../SafeImage";
import type { Category, ProductType } from "@/lib/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { VariantEditor } from "./AdminCatalogEditors";
import { inferProductPreset, type AdminProduct } from "./catalog-model";
import {
  applySafeContentQualityFixes,
  auditProductContent,
  productContentCompletion,
  safeContentFixCount,
} from "@/lib/product-content";
import { productSellabilityPreflight } from "@/lib/product-sellability";
import { useAdminCatalog } from "./useAdminCatalog";

type ProductEditorSection =
  | "essential"
  | "sale"
  | "content"
  | "photos"
  | "quality"
  | "advanced";

const PRODUCT_EDITOR_SECTIONS: Array<{
  id: ProductEditorSection;
  label: string;
}> = [
  { id: "essential", label: "Essentiel" },
  { id: "sale", label: "Vente" },
  { id: "content", label: "Contenu" },
  { id: "photos", label: "Photos" },
  { id: "quality", label: "SEO & qualité" },
  { id: "advanced", label: "Avancé" },
];

function productDraftFingerprint(product: AdminProduct) {
  return JSON.stringify({
    slug: product.slug.trim(),
    category_id: product.category_id,
    type: product.type,
    name_fr: product.name_fr,
    name_en: product.name_en,
    description_fr: product.description_fr,
    description_en: product.description_en,
    long_description_fr: product.long_description_fr ?? "",
    long_description_en: product.long_description_en ?? "",
    origin: product.origin ?? "",
    cultivar: product.cultivar ?? "",
    badge: product.badge ?? "",
    base_price: Number(product.base_price),
    stock: Number(product.stock),
    pickup_only: product.pickup_only,
    active: product.active,
    featured: product.featured,
    sort_order: Number(product.sort_order),
    image_url: product.image_url ?? "",
    ideal_for: (product.ideal_for ?? []).map((value) =>
      String(value).trim(),
    ),
    shipping_weight_g: Number(product.shipping_weight_g || 0),
  });
}


export function AdminCatalog({
  supabase,
  categories,
}: {
  supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>;
  categories: Category[];
}) {
  const {
    products,
    setProducts,
    variants,
    setVariants,
    selectedId,
    productDraft,
    setProductDraft,
    saving,
    message,
    catalogZone,
    setCatalogZone,
    catalogSearch,
    setCatalogSearch,
    quickSavingId,
    advancedOpen,
    setAdvancedOpen,
    chooseProduct,
    changeDraftCategory,
    saveProduct,
    deleteProduct,
    quickPatchProduct,
    duplicateProduct,
    moveProduct,
    addVariant,
    saveVariant,
    deleteVariant,
  } = useAdminCatalog(supabase, categories);
  const [contentQualityOnly, setContentQualityOnly] = useState(false);

  const selectedVariants = variants.filter((variant) => variant.product_id === productDraft.id);
  const categoryById = new Map<string, Category>(categories.map((category) => [category.id, category]));
  const productContentIssues = (product: AdminProduct) => auditProductContent({
    ...product,
    kind: categoryById.get(product.category_id)?.kind,
  });
  const productCompletion = (product: AdminProduct) => productContentCompletion({
    ...product,
    kind: categoryById.get(product.category_id)?.kind,
  });
  const shopProducts = products.filter((product) => categoryById.get(product.category_id)?.kind === "shop");
  const shopReviewProducts = shopProducts
    .filter((product) => productContentIssues(product).length > 0)
    .sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));
  const shopContentReviewCount = shopReviewProducts.length;
  const shopContentReadyCount = Math.max(0, shopProducts.length - shopContentReviewCount);
  const shopContentProgress = shopProducts.length
    ? Math.round((shopContentReadyCount / shopProducts.length) * 100)
    : 100;
  const draftCategory = categoryById.get(productDraft.category_id);
  const draftPreset = !productDraft.id && draftCategory ? inferProductPreset(draftCategory, draftCategory.kind) : null;
  const draftContentIssues = draftCategory?.kind === "shop" ? auditProductContent({ ...productDraft, kind: "shop" }) : [];
  const draftSellability = draftCategory?.kind === "shop"
    ? productSellabilityPreflight(productDraft, selectedVariants)
    : null;
  const draftSellabilityBlockers = draftSellability?.blockers ?? [];
  const draftSellabilityWarnings = draftSellability?.warnings ?? [];
  const draftCompletion = draftCategory?.kind === "shop"
    ? productContentCompletion({ ...productDraft, kind: "shop" })
    : null;
  const draftSafeFixCount = draftCategory?.kind === "shop" ? safeContentFixCount({ ...productDraft, kind: "shop" }) : 0;
  const draftHasShortEnLanguageWarning = draftContentIssues.some((issue) => issue.code === "short_en_likely_fr");
  const currentReviewIndex = productDraft.id
    ? shopReviewProducts.findIndex((product) => product.id === productDraft.id)
    : -1;
  const previousReviewProduct = currentReviewIndex > 0 ? shopReviewProducts[currentReviewIndex - 1] : null;
  const nextReviewProduct = currentReviewIndex >= 0
    ? shopReviewProducts[currentReviewIndex + 1] ?? null
    : shopReviewProducts[0] ?? null;
  const reviewAdvanceProduct =
    nextReviewProduct && nextReviewProduct.id !== productDraft.id
      ? nextReviewProduct
      : null;
  const isFinalReviewProduct =
    currentReviewIndex === 0 && shopContentReviewCount === 1;
  const catalogCategories = categories.filter((category) => category.kind === catalogZone);
  const normalizedCatalogSearch = catalogSearch.trim().toLowerCase();
  const catalogProducts = products
    .filter((product) => categoryById.get(product.category_id)?.kind === catalogZone)
    .filter((product) => catalogZone !== "shop" || !contentQualityOnly || productContentIssues(product).length > 0)
    .filter((product) => !normalizedCatalogSearch || `${product.name_fr} ${product.name_en} ${product.badge ?? ""} ${categoryById.get(product.category_id)?.name_fr ?? ""}`.toLowerCase().includes(normalizedCatalogSearch))
    .sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));
  const catalogCounts = { menu: products.filter((product) => categoryById.get(product.category_id)?.kind === "menu").length, shop: products.filter((product) => categoryById.get(product.category_id)?.kind === "shop").length };
  const catalogCategoryGroups = catalogCategories.map((category) => ({
    category,
    products: catalogProducts.filter((product) => product.category_id === category.id),
    totalCount: products.filter((product) => product.category_id === category.id).length,
  })).filter((group) => !normalizedCatalogSearch || group.products.length > 0);

  const savedDraft = productDraft.id
    ? products.find((product) => product.id === productDraft.id) ?? null
    : null;
  const draftDirty = productDraft.id
    ? Boolean(
        savedDraft &&
          productDraftFingerprint(savedDraft) !==
            productDraftFingerprint(productDraft),
      )
    : Boolean(
        productDraft.name_fr.trim() ||
          productDraft.description_fr.trim() ||
          productDraft.image_url,
      );
  const publicProductHref =
    draftCategory?.kind === "shop" &&
    productDraft.id &&
    productDraft.slug.trim()
      ? `/boutique/${encodeURIComponent(productDraft.slug.trim())}`
      : null;

  function editorFieldHint(
    codes: string[],
    readyLabel: string,
  ) {
    const matches = draftContentIssues.filter((issue) =>
      codes.includes(issue.code),
    );

    if (!matches.length) {
      return (
        <small className="product-editor-field-hint-v477 ready">
          ✓ {readyLabel}
        </small>
      );
    }

    const level = matches.some((issue) => issue.level === "error")
      ? "error"
      : "warning";

    return (
      <small className={`product-editor-field-hint-v477 ${level}`}>
        ⚠ {matches.map((issue) => issue.label).join(" · ")}
      </small>
    );
  }

  function scrollEditorSection(section: ProductEditorSection) {
    document
      .getElementById(`product-editor-${section}-v477`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function closeEditor() {
    if (
      draftDirty &&
      !window.confirm(
        "Fermer sans enregistrer les modifications de cette fiche ?",
      )
    ) {
      return;
    }

    setAdvancedOpen(false);
  }

  function applySafeEditorialFixes() {
    setProductDraft((current) => ({
      ...current,
      ...applySafeContentQualityFixes({
        ...current,
        kind: categoryById.get(current.category_id)?.kind,
      }),
    }));
  }

  function useFrenchFallbackForShortEnglish() {
    setProductDraft((current) => ({
      ...current,
      description_en: current.description_fr,
    }));
  }

  async function saveAndOpenNextReview() {
    const target = reviewAdvanceProduct;
    if (!target) return;

    const savedProduct = await saveProduct();
    if (!savedProduct) return;

    const savedKind = categoryById.get(savedProduct.category_id)?.kind;
    const remainingIssues =
      savedKind === "shop"
        ? auditProductContent({ ...savedProduct, kind: "shop" })
        : [];

    // Persisting is not enough: unresolved content must never be skipped.
    if (remainingIssues.length > 0) return;

    chooseProduct(target, "shop", undefined, true);
  }

  async function saveAndFinishReview() {
    if (!isFinalReviewProduct) return;

    const savedProduct = await saveProduct();
    if (!savedProduct) return;

    const savedKind = categoryById.get(savedProduct.category_id)?.kind;
    const remainingIssues =
      savedKind === "shop"
        ? auditProductContent({ ...savedProduct, kind: "shop" })
        : [];

    // Keep the drawer open if normalization or persistence still leaves work.
    if (remainingIssues.length > 0) return;

    setContentQualityOnly(false);
    setAdvancedOpen(false);
  }

  function toggleQuickVisibility(product: AdminProduct) {
    const kind = categoryById.get(product.category_id)?.kind;
    const productVariants = variants.filter(
      (variant) => variant.product_id === product.id,
    );
    const sellability =
      kind === "shop"
        ? productSellabilityPreflight(product, productVariants)
        : null;

    if (
      !product.active &&
      kind === "shop" &&
      (productContentIssues(product).length > 0 ||
        Boolean(sellability?.blockers.length))
    ) {
      chooseProduct(product);
      return;
    }

    void quickPatchProduct(product.id, { active: !product.active });
  }

  function renderQuickProductRow(product: AdminProduct, index: number, orderedProducts: AdminProduct[]) {
    const productVariants = variants.filter((variant) => variant.product_id === product.id);
    const totalVariantStock = productVariants.filter((variant) => variant.active).reduce((sum, variant) => sum + Math.max(0, Number(variant.stock)), 0);
    const contentIssues = catalogZone === "shop" ? productContentIssues(product) : [];
    const sellability = catalogZone === "shop"
      ? productSellabilityPreflight(product, productVariants)
      : null;
    const sellabilityBlockers = sellability?.blockers ?? [];
    return <article className={`quick-product-row zone-${catalogZone} ${!product.active ? "is-hidden" : ""}`} key={product.id}>
      <div className="quick-product-image"><SafeImage src={product.image_url || "/product-placeholder.svg"} alt="" width={128} height={128} sizes="(max-width: 1280px) 58px, 64px" /><button type="button" className={product.featured ? "featured active" : "featured"} title="Mettre en avant" onClick={() => quickPatchProduct(product.id, { featured: !product.featured })}>★</button></div>
      <div className="quick-product-main">
        <div className="quick-name-line"><input aria-label="Nom du produit" value={product.name_fr} onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, name_fr: e.target.value } : item))} onBlur={() => quickPatchProduct(product.id, { name_fr: product.name_fr, name_en: product.name_en || product.name_fr })} /><span className={`visibility-dot ${product.active ? "on" : "off"}`}></span></div>
        <div className="quick-meta-line"><select aria-label="Catégorie" value={product.category_id} onChange={(e) => quickPatchProduct(product.id, { category_id: e.target.value })}>{catalogCategories.map((item) => <option key={item.id} value={item.id}>{item.name_fr}</option>)}</select>{productVariants.length ? <button type="button" className="mini-chip" onClick={() => chooseProduct(product)}>{productVariants.length} format{productVariants.length > 1 ? "s" : ""}</button> : <span className="mini-chip subtle">Sans variante</span>}{product.badge && <span className="mini-chip">{product.badge}</span>}{contentIssues.length > 0 && <button type="button" className="content-quality-chip-v451" title={contentIssues.map((issue) => issue.label).join(" · ")} onClick={() => chooseProduct(product)}>Contenu {contentIssues.length}</button>}</div>
      </div>
      <label className="quick-field"><span>Prix</span><div><input type="number" min="0" step="0.01" value={product.base_price} onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, base_price: Number(e.target.value) } : item))} onBlur={() => quickPatchProduct(product.id, { base_price: product.base_price })} /><b>€</b></div></label>
      {catalogZone === "shop" ? <>
        {productVariants.length ? <div className="quick-stock-summary"><span>Stock</span><strong>{totalVariantStock}</strong><small>via modèles</small></div> : <label className="quick-field"><span>Stock</span><input type="number" min="0" value={product.stock} onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, stock: Number(e.target.value) } : item))} onBlur={() => quickPatchProduct(product.id, { stock: product.stock })} /></label>}
        <label className={`quick-field ${!product.pickup_only && !product.shipping_weight_g ? "needs-value" : ""}`}><span>Poids colis</span><div><input type="number" min="0" value={product.shipping_weight_g || 0} onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, shipping_weight_g: Number(e.target.value) } : item))} onBlur={() => quickPatchProduct(product.id, { shipping_weight_g: product.shipping_weight_g })} /><b>g</b></div></label>
      </> : <div className="quick-menu-info"><span>{product.type === "dessert" ? "Dessert" : product.type === "combo" ? "Combo" : "Boisson"}</span><small>Carte uniquement</small></div>}
      <button type="button" className={`quick-visibility ${product.active ? "active" : ""} ${!product.active && catalogZone === "shop" && (contentIssues.length > 0 || sellabilityBlockers.length > 0) ? "blocked-by-content-v456 blocked-by-sellability-v457" : ""}`} title={!product.active && catalogZone === "shop" && contentIssues.length > 0 ? "Corrigez le contenu avant de publier" : !product.active && catalogZone === "shop" && sellabilityBlockers.length > 0 ? "Corrigez la configuration de vente avant de publier" : product.active ? "Masquer le produit" : "Publier le produit"} onClick={() => toggleQuickVisibility(product)}>{product.active ? "Visible" : "Masqué"}</button>
      <div className="quick-row-actions"><button type="button" title={normalizedCatalogSearch ? "Effacez la recherche pour réordonner" : "Monter dans cette catégorie"} disabled={index === 0 || Boolean(normalizedCatalogSearch)} onClick={() => moveProduct(product, -1)}>↑</button><button type="button" title={normalizedCatalogSearch ? "Effacez la recherche pour réordonner" : "Descendre dans cette catégorie"} disabled={index === orderedProducts.length - 1 || Boolean(normalizedCatalogSearch)} onClick={() => moveProduct(product, 1)}>↓</button><button type="button" title="Dupliquer" onClick={() => duplicateProduct(product)}>⧉</button><button type="button" className="details" onClick={() => chooseProduct(product)}>Détails</button></div>
    </article>;
  }

  return (
<div className="quick-catalog-admin">
      <div className="quick-catalog-toolbar">
        <div className="catalog-zone-switch" role="tablist" aria-label="Zone du catalogue">
          <button type="button" className={catalogZone === "menu" ? "active" : ""} onClick={() => { setCatalogZone("menu"); setAdvancedOpen(false); }}><span>Menu</span><strong>{catalogCounts.menu}</strong></button>
          <button type="button" className={catalogZone === "shop" ? "active" : ""} onClick={() => { setCatalogZone("shop"); setAdvancedOpen(false); }}><span>Boutique</span><strong>{catalogCounts.shop}</strong></button>
        </div>
        <div className="quick-catalog-actions"><input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder={`Rechercher dans ${catalogZone === "menu" ? "le menu" : "la boutique"}…`} />{catalogZone === "shop" && (shopContentReviewCount > 0 ? <button className={`button ghost small content-quality-filter-v451 ${contentQualityOnly ? "active" : ""}`} type="button" aria-pressed={contentQualityOnly} onClick={() => setContentQualityOnly((current) => !current)}>{contentQualityOnly ? "Afficher tout" : `À revoir · ${shopContentReviewCount}`}</button> : <button className="button ghost small content-quality-filter-v451 content-quality-filter-v455-ready" type="button" disabled>Contenu prêt ✓</button>)}<button className="button primary small" type="button" onClick={() => chooseProduct(undefined, catalogZone)}>+ Ajouter</button></div>
      </div>
      <div className="quick-admin-hint"><strong>Modification rapide</strong><span>Prix, stock, poids, visibilité et ordre se modifient directement ici. Ouvrez “Détails” uniquement pour les descriptions, images, options ou variantes.</span>{catalogZone === "shop" && <span className={`content-quality-summary-v451 ${shopContentReviewCount ? "needs-review" : "ready"}`}>{shopContentReviewCount ? `${shopContentReviewCount} produit${shopContentReviewCount > 1 ? "s" : ""} à revoir` : "Contenu Boutique prêt ✓"}</span>}{quickSavingId && <em>Enregistrement…</em>}</div>
      {catalogZone === "shop" && <div className="content-completion-overview-v453" aria-label="Progression du contenu Boutique"><div><strong>{shopContentReadyCount}/{shopProducts.length} fiches prêtes</strong><span>{shopContentReviewCount ? `${shopContentReviewCount} à revoir` : "Tout le contenu est prêt ✓"}</span></div><div className="content-completion-track-v453" aria-hidden="true"><span style={{ width: `${shopContentProgress}%` }}></span></div><b>{shopContentProgress}%</b></div>}
      {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}
      <div className={`quick-catalog-category-list zone-${catalogZone}`}>
        {catalogCategoryGroups.length ? catalogCategoryGroups.map(({ category, products: categoryProducts, totalCount }) => {
          const categoryStock = categoryProducts.reduce((sum, product) => {
            const productVariants = variants.filter((variant) => variant.product_id === product.id && variant.active);
            return sum + (productVariants.length ? productVariants.reduce((variantSum, variant) => variantSum + Math.max(0, Number(variant.stock)), 0) : Math.max(0, Number(product.stock)));
          }, 0);
          return <details className={`quick-catalog-category ${category.active ? "" : "is-hidden-category"}`} key={category.id} open>
            <summary className="quick-catalog-category-head">
              <div className="quick-catalog-category-title">
                <span className="category-drag-dot" aria-hidden="true"></span>
                <strong>{category.name_fr}</strong>
                <span className="category-count">{normalizedCatalogSearch ? categoryProducts.length : totalCount}</span>
                {catalogZone === "shop" && categoryProducts.length > 0 && <span className="category-stock-badge">Stock {categoryStock}</span>}
                {!category.active && <span className="category-hidden-badge">Catégorie masquée</span>}
              </div>
              <button type="button" className="button ghost small category-add-button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); chooseProduct(undefined, catalogZone, category.id); }}>+ Ajouter</button>
            </summary>
            <div className="quick-catalog-category-body">
              {categoryProducts.length ? categoryProducts.map((product, index) => renderQuickProductRow(product, index, categoryProducts)) : <button type="button" className="empty-category-add" onClick={() => chooseProduct(undefined, catalogZone, category.id)}>+ Ajouter {catalogZone === "menu" ? "un article" : "un produit"} dans {category.name_fr}</button>}
            </div>
          </details>;
        }) : <div className="empty-state">{normalizedCatalogSearch ? `Aucun ${catalogZone === "menu" ? "article" : "produit"} ne correspond à cette recherche.` : `Aucune catégorie ${catalogZone === "menu" ? "Menu" : "Boutique"}. Créez d’abord une catégorie.`}</div>}
      </div>

      {advancedOpen && selectedId && <div className="quick-detail-panel">
        <div className="quick-detail-backdrop" onClick={closeEditor}></div>
        <div
          className="quick-detail-drawer product-editor-drawer-v477"
          role="dialog"
          aria-modal="true"
          aria-label="Détails du produit"
        >
          <form onSubmit={saveProduct}>
            <div className="editor-head sticky-editor-head product-editor-head-v477">
              <div>
                <p className="eyebrow">
                  {productDraft.id ? "PRODUIT" : "NOUVEAU"}
                </p>
                <h2>
                  {productDraft.name_fr ||
                    (catalogZone === "menu"
                      ? "Nouvel article du menu"
                      : "Nouveau produit boutique")}
                </h2>
                <div className="product-editor-head-meta-v477">
                  <span>
                    {draftCategory?.kind === "shop" ? "Boutique" : "Carte"}
                  </span>
                  {draftCategory && <span>{draftCategory.name_fr}</span>}
                  {productDraft.id && (
                    <span className={productDraft.active ? "ready" : ""}>
                      {productDraft.active ? "Visible" : "Masqué"}
                    </span>
                  )}
                </div>
              </div>
              <div>
                {publicProductHref && (
                  <a
                    className="button ghost small"
                    href={publicProductHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir la fiche ↗
                  </a>
                )}
                <button
                  type="button"
                  className="button ghost small"
                  onClick={closeEditor}
                >
                  Fermer
                </button>
              </div>
            </div>

            <nav
              className="product-editor-nav-v477"
              aria-label="Sections de la fiche produit"
            >
              {PRODUCT_EDITOR_SECTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollEditorSection(section.id)}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            {message && (
              <p
                className={
                  message.includes("✓")
                    ? "save-message success"
                    : "save-message"
                }
              >
                {message}
              </p>
            )}

            {!productDraft.id && draftPreset && (
              <div className="smart-add-banner">
                <div>
                  <span className="smart-add-kicker">
                    Préconfiguration automatique
                  </span>
                  <strong>{draftCategory?.name_fr}</strong>
                  <p>{draftPreset.note}</p>
                </div>
                <div className="smart-add-chips">
                  <span>{draftPreset.title}</span>
                  <span>{draftPreset.fulfillment}</span>
                  <span>
                    {catalogZone === "menu"
                      ? "Sans stock"
                      : "Stock à renseigner"}
                  </span>
                  <span className="draft-chip">Brouillon masqué</span>
                </div>
              </div>
            )}

            <section
              className="product-editor-section-v477"
              id="product-editor-essential-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>01</span>
                  <div>
                    <h3>Essentiel</h3>
                    <p>
                      Identité, classement et visibilité — les champs utilisés
                      le plus souvent.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-grid three">
                <label>
                  Nom FR
                  <input
                    value={productDraft.name_fr}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        name_fr: e.target.value,
                      })
                    }
                    required
                  />
                  <small
                    className={`product-editor-field-hint-v477 ${
                      productDraft.name_fr.trim().length > 65
                        ? "warning"
                        : "ready"
                    }`}
                  >
                    {productDraft.name_fr.trim().length > 65
                      ? `⚠ ${productDraft.name_fr.trim().length} caractères · title potentiellement long`
                      : `✓ ${productDraft.name_fr.trim().length} caractère${productDraft.name_fr.trim().length > 1 ? "s" : ""}`}
                  </small>
                </label>

                <label>
                  Nom EN <small>(facultatif, FR utilisé si vide)</small>
                  <input
                    value={productDraft.name_en}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        name_en: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Type {draftPreset && <small>(pré-rempli)</small>}
                  <select
                    value={productDraft.type}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        type: e.target.value as ProductType,
                      })
                    }
                  >
                    <option value="drink">Boisson</option>
                    <option value="dessert">Dessert</option>
                    <option value="product">Matcha / produit</option>
                    <option value="accessory">Accessoire</option>
                    <option value="combo">Combo</option>
                  </select>
                </label>

                <label>
                  Catégorie
                  <select
                    value={productDraft.category_id}
                    onChange={(e) => changeDraftCategory(e.target.value)}
                    required
                  >
                    <option value="">—</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.kind === "menu"
                          ? "Carte · "
                          : "Boutique · "}
                        {category.name_fr}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Badge
                  <input
                    value={productDraft.badge ?? ""}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        badge: e.target.value,
                      })
                    }
                    placeholder="Signature, Nouveau…"
                  />
                </label>

                {draftCategory?.kind === "menu" && (
                  <label>
                    Prix (€)
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={productDraft.base_price}
                      onChange={(e) =>
                        setProductDraft({
                          ...productDraft,
                          base_price: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </div>

              <div className="quick-boolean-grid">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={productDraft.active}
                    disabled={!productDraft.active && draftCategory?.kind === "shop" && (draftContentIssues.length > 0 || draftSellabilityBlockers.length > 0)}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        active: e.target.checked,
                      })
                    }
                  />{" "}
                  Visible
                  {!productDraft.active &&
                    draftCategory?.kind === "shop" &&
                    (draftContentIssues.length > 0 ||
                      draftSellabilityBlockers.length > 0) && (
                      <small className="publish-guard-inline-v456">
                        {draftContentIssues.length > 0
                          ? "Contenu à corriger avant publication"
                          : "Configuration de vente à corriger avant publication"}
                      </small>
                    )}
                </label>

                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={productDraft.featured}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        featured: e.target.checked,
                      })
                    }
                  />{" "}
                  Mis en avant
                </label>
              </div>

              {draftCategory?.kind === "menu" && (
                <p className="menu-admin-note-v227">
                  Article informatif uniquement : aucune option, aucun stock et
                  aucune commande en ligne.
                </p>
              )}
            </section>

            <section
              className="product-editor-section-v477"
              id="product-editor-sale-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>02</span>
                  <div>
                    <h3>Vente</h3>
                    <p>
                      Prix, stock, expédition et formats sont regroupés ici.
                    </p>
                  </div>
                </div>
              </div>

              {draftCategory?.kind === "shop" ? (
                <>
                  <div className="form-grid three product-editor-sale-grid-v477">
                    <label>
                      Prix de base (€)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={productDraft.base_price}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            base_price: Number(e.target.value),
                          })
                        }
                      />
                      <small className="product-editor-field-hint-v477 ready">
                        ✓ Utilisé si aucun format actif ne remplace ce prix
                      </small>
                    </label>

                    {selectedVariants.length === 0 && (
                      <label>
                        Stock
                        <input
                          type="number"
                          min="0"
                          value={productDraft.stock}
                          onChange={(e) =>
                            setProductDraft({
                              ...productDraft,
                              stock: Number(e.target.value),
                            })
                          }
                        />
                        <small>Utilisé uniquement sans modèle.</small>
                      </label>
                    )}

                    <label>
                      Poids expédition (g)
                      <input
                        type="number"
                        min="0"
                        value={productDraft.shipping_weight_g ?? 0}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            shipping_weight_g: Number(e.target.value),
                          })
                        }
                      />
                      <small
                        className={`product-editor-field-hint-v477 ${
                          !productDraft.pickup_only &&
                          Number(productDraft.shipping_weight_g || 0) <= 0
                            ? "warning"
                            : "ready"
                        }`}
                      >
                        {!productDraft.pickup_only &&
                        Number(productDraft.shipping_weight_g || 0) <= 0
                          ? "⚠ Poids requis pour une expédition fiable"
                          : "✓ Livraison / retrait cohérent"}
                      </small>
                    </label>
                  </div>

                  <div className="quick-boolean-grid product-editor-sale-switches-v477">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={productDraft.pickup_only}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            pickup_only: e.target.checked,
                          })
                        }
                      />{" "}
                      Retrait uniquement
                    </label>
                  </div>

                  <div className="product-editor-variants-v477">
                    <div className="section-inline">
                      <div>
                        <strong>
                          Formats / variantes{" "}
                          {selectedVariants.length
                            ? `(${selectedVariants.length})`
                            : ""}
                        </strong>
                        <p className="muted">
                          Boîte 30 g, Sachet 30 g, Boîte 100 g… Chaque modèle
                          conserve son prix, son stock et son poids.
                        </p>
                        <small className="muted">
                          Un nouveau format est créé masqué : complétez-le puis
                          cochez « Actif ».
                        </small>
                      </div>
                      <button type="button" onClick={addVariant}>
                        + Ajouter un modèle
                      </button>
                    </div>

                    {!productDraft.id ? (
                      <p className="muted">
                        Enregistrez d’abord le produit.
                      </p>
                    ) : selectedVariants.length ? (
                      <div className="variant-admin-list">
                        {selectedVariants.map((variant) => (
                          <VariantEditor
                            key={variant.id}
                            variant={variant}
                            onChange={(next) =>
                              setVariants((current) =>
                                current.map((v) =>
                                  v.id === next.id ? next : v,
                                ),
                              )
                            }
                            onSave={saveVariant}
                            onDelete={deleteVariant}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        Aucun modèle. Le prix et le stock de base seront
                        utilisés.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="product-editor-empty-section-v477">
                  <strong>Article de carte</strong>
                  <span>
                    Pas de stock ni d’expédition : le prix est modifiable dans
                    Essentiel.
                  </span>
                </div>
              )}
            </section>

            <section
              className="product-editor-section-v477"
              id="product-editor-content-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>03</span>
                  <div>
                    <h3>Contenu</h3>
                    <p>
                      Chaque signal apparaît près du champ à corriger, sans
                      attendre le diagnostic final.
                    </p>
                  </div>
                </div>
              </div>

              <div className="description-help">
                <div>
                  <strong>Texte court = carte</strong>
                  <span>
                    {draftCategory?.kind === "menu"
                      ? "Gardez 1–3 phrases : c’est tout ce que le visiteur voit sur la carte."
                      : "Gardez 1–3 phrases. Le texte long apparaît dans la fiche Boutique."}
                  </span>
                </div>
                <span
                  className={
                    productDraft.description_fr.length > 180
                      ? "description-count warning"
                      : "description-count"
                  }
                >
                  {productDraft.description_fr.length}/180 conseillé
                </span>
              </div>

              <div className="form-grid">
                <label>
                  Description courte FR
                  <textarea
                    rows={3}
                    maxLength={260}
                    value={productDraft.description_fr}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        description_fr: e.target.value,
                      })
                    }
                    placeholder="Ex. Un matcha Uji doux, umami et équilibré, idéal en usucha ou latte."
                  />
                  {draftCategory?.kind === "shop"
                    ? editorFieldHint(
                        ["short_fr_missing", "short_fr_likely_en"],
                        "Texte court FR cohérent",
                      )
                    : (
                      <small>Utilisée sur la carte Menu.</small>
                    )}
                </label>

                <label>
                  Description courte EN <small>(facultatif)</small>
                  <textarea
                    rows={3}
                    maxLength={260}
                    value={productDraft.description_en}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        description_en: e.target.value,
                      })
                    }
                    placeholder="Short description shown on product cards."
                  />
                  {draftCategory?.kind === "shop"
                    ? editorFieldHint(
                        ["short_en_likely_fr"],
                        productDraft.description_en.trim()
                          ? "Texte court EN cohérent"
                          : "Fallback FR accepté",
                      )
                    : (
                      <small>Si vide, le français est utilisé.</small>
                    )}
                </label>
              </div>

              {draftCategory?.kind === "shop" && (
                <>
                  <div className="form-grid long-description-grid">
                    <label>
                      Description complète FR
                      <textarea
                        rows={7}
                        value={productDraft.long_description_fr ?? ""}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            long_description_fr: e.target.value,
                          })
                        }
                        placeholder="Histoire du produit, profil aromatique, conseils, détails de préparation…"
                      />
                      {editorFieldHint(
                        ["long_fr_missing", "long_fr_likely_en"],
                        "Fiche complète FR cohérente",
                      )}
                    </label>

                    <label>
                      Description complète EN <small>(facultatif)</small>
                      <textarea
                        rows={7}
                        value={productDraft.long_description_en ?? ""}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            long_description_en: e.target.value,
                          })
                        }
                        placeholder="Full product description."
                      />
                      {editorFieldHint(
                        ["long_en_likely_fr"],
                        productDraft.long_description_en?.trim()
                          ? "Fiche complète EN cohérente"
                          : "Fallback du texte court accepté",
                      )}
                    </label>
                  </div>

                  <div className="description-actions">
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() =>
                        setProductDraft((current) => ({
                          ...current,
                          long_description_fr:
                            current.long_description_fr?.trim()
                              ? current.long_description_fr
                              : current.description_fr,
                        }))
                      }
                    >
                      Utiliser le texte court comme base FR
                    </button>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() =>
                        setProductDraft((current) => ({
                          ...current,
                          long_description_en:
                            current.long_description_en?.trim()
                              ? current.long_description_en
                              : current.description_en ||
                                current.description_fr,
                        }))
                      }
                    >
                      Utiliser le texte court comme base EN
                    </button>
                  </div>

                  <div className="form-grid three">
                    <label>
                      Origine
                      <input
                        value={productDraft.origin ?? ""}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            origin: e.target.value,
                          })
                        }
                      />
                      {editorFieldHint(
                        ["origin_missing"],
                        productDraft.type === "product"
                          ? "Origine renseignée"
                          : "Origine optionnelle",
                      )}
                    </label>

                    <label>
                      Cultivar / base
                      <input
                        value={productDraft.cultivar ?? ""}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            cultivar: e.target.value,
                          })
                        }
                      />
                      <small className="product-editor-field-hint-v477 ready">
                        ✓ Optionnel
                      </small>
                    </label>

                    <label>
                      Idéal pour
                      <input
                        value={productDraft.ideal_for.join(", ")}
                        onChange={(e) =>
                          setProductDraft({
                            ...productDraft,
                            ideal_for: e.target.value
                              .split(",")
                              .map((v) => v.trim()),
                          })
                        }
                        placeholder="Usucha, latte…"
                      />
                      {editorFieldHint(
                        ["ideal_for_missing", "ideal_for_cleanup"],
                        productDraft.type === "product"
                          ? "Usages renseignés"
                          : "Usages optionnels",
                      )}
                    </label>
                  </div>

                  {draftContentIssues.some(
                    (issue) => issue.code === "supplier_boilerplate",
                  ) && (
                    <div className="product-editor-field-global-v477 warning">
                      ⚠ Texte fournisseur / livraison internationale détecté
                      dans au moins une description.
                    </div>
                  )}
                </>
              )}
            </section>

            <section
              className="product-editor-section-v477"
              id="product-editor-photos-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>04</span>
                  <div>
                    <h3>Photos</h3>
                    <p>
                      Image principale et galerie restent gérées par le
                      composant média existant.
                    </p>
                  </div>
                </div>
              </div>

              <ProductGalleryAdmin
                productId={productDraft.id}
                productName={productDraft.name_fr || "Produit"}
                catalogKind={categoryById.get(productDraft.category_id)?.kind ?? catalogZone}
                fallbackImageUrl={productDraft.image_url}
                onMainImageChange={(url) =>
                  setProductDraft((current) => ({
                    ...current,
                    image_url: url,
                  }))
                }
              />
            </section>

            <section
              className="product-editor-section-v477 product-editor-quality-v477"
              id="product-editor-quality-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>05</span>
                  <div>
                    <h3>SEO & qualité</h3>
                    <p>
                      Diagnostic après les champs : publication, vendabilité et
                      qualité éditoriale utilisent les contrôles existants.
                    </p>
                  </div>
                </div>
                {publicProductHref && (
                  <a
                    className="button ghost small"
                    href={publicProductHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Voir la fiche publique ↗
                  </a>
                )}
              </div>

              {draftCategory?.kind === "shop" &&
                !productDraft.active &&
                (draftContentIssues.length > 0 ||
                  draftSellabilityBlockers.length > 0) && (
                  <div
                    className="publish-guard-banner-v456"
                    role="status"
                  >
                    <strong>Publication verrouillée</strong>
                    <span>
                      {draftContentIssues.length > 0
                        ? `Corrigez les ${draftContentIssues.length} point${draftContentIssues.length > 1 ? "s" : ""} de contenu signalé${draftContentIssues.length > 1 ? "s" : ""}.`
                        : `Corrigez les ${draftSellabilityBlockers.length} point${draftSellabilityBlockers.length > 1 ? "s" : ""} de configuration de vente.`}
                    </span>
                  </div>
                )}

              {draftCategory?.kind === "shop" && draftSellability && (
                <div
                  className={`sellability-card-v457 ${
                    draftSellabilityBlockers.length ? "blocked" : "ready"
                  }`}
                >
                  <div className="sellability-head-v457">
                    <div>
                      <span>PRÊT À VENDRE</span>
                      <strong>
                        {draftSellabilityBlockers.length
                          ? `${draftSellabilityBlockers.length} blocage${draftSellabilityBlockers.length > 1 ? "s" : ""}`
                          : "Configuration vendable ✓"}
                      </strong>
                    </div>
                    {draftSellabilityWarnings.length > 0 && (
                      <em>
                        {draftSellabilityWarnings.length} avertissement
                        {draftSellabilityWarnings.length > 1 ? "s" : ""}
                      </em>
                    )}
                  </div>
                  <div className="sellability-checks-v457">
                    {draftSellability.checks.map((check) => (
                      <div
                        className={`sellability-check-v457 ${check.status}`}
                        key={check.id}
                        title={check.detail}
                      >
                        <span>
                          {check.status === "ready"
                            ? "✓"
                            : check.status === "warning"
                              ? "!"
                              : "×"}
                        </span>
                        <div>
                          <strong>{check.label}</strong>
                          <small>
                            {check.status === "ready"
                              ? "Prêt"
                              : check.status === "warning"
                                ? "À vérifier"
                                : "Bloquant"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                  {draftSellability.issues.length > 0 && (
                    <ul className="sellability-issues-v457">
                      {draftSellability.issues.map((issue) => (
                        <li className={issue.level} key={issue.code}>
                          {issue.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {draftCategory?.kind === "shop" && draftCompletion && (
                <div className="content-completion-card-v453">
                  <div className="content-completion-head-v453">
                    <div>
                      <span>FICHE PRODUIT</span>
                      <strong>
                        {draftCompletion.completedCount}/
                        {draftCompletion.totalCount} points prêts
                      </strong>
                    </div>
                    <b>{draftCompletion.percent}%</b>
                  </div>
                  <div className="content-completion-steps-v453">
                    {draftCompletion.steps.map((step) => (
                      <div
                        className={`content-completion-step-v453 ${step.status}`}
                        key={step.id}
                        title={step.detail}
                      >
                        <span>
                          {step.status === "ready"
                            ? "✓"
                            : step.status === "fallback"
                              ? "↳"
                              : "!"}
                        </span>
                        <div>
                          <strong>{step.label}</strong>
                          <small>
                            {step.status === "ready"
                              ? "Prêt"
                              : step.status === "fallback"
                                ? "Fallback accepté"
                                : "À vérifier"}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {draftCategory?.kind === "shop" && (
                <div
                  className={`content-quality-panel-v451 ${
                    draftContentIssues.length ? "needs-review" : "ready"
                  }`}
                >
                  <div>
                    <span className="content-quality-kicker-v451">
                      QUALITÉ DU CONTENU
                    </span>
                    <strong>
                      {draftContentIssues.length
                        ? `${draftContentIssues.length} point${draftContentIssues.length > 1 ? "s" : ""} à vérifier`
                        : "Contenu prêt ✓"}
                    </strong>
                    <p>
                      {draftContentIssues.length
                        ? "Les champs concernés sont signalés plus haut ; ce résumé confirme ce qui reste à traiter."
                        : "Descriptions et informations essentielles sont cohérentes."}
                    </p>
                    {draftContentIssues.length > 0 && (
                      <div className="content-quality-actions-v452">
                        {draftSafeFixCount > 0 && (
                          <button
                            type="button"
                            className="button ghost small"
                            onClick={applySafeEditorialFixes}
                          >
                            Appliquer {draftSafeFixCount} correction
                            {draftSafeFixCount > 1 ? "s" : ""} sûre
                            {draftSafeFixCount > 1 ? "s" : ""}
                          </button>
                        )}
                        {draftHasShortEnLanguageWarning && (
                          <button
                            type="button"
                            className="button ghost small"
                            onClick={useFrenchFallbackForShortEnglish}
                          >
                            Utiliser le fallback FR pour EN
                          </button>
                        )}
                        <small>
                          Le brouillon est seulement prérempli : vérifiez les
                          champs puis cliquez sur Enregistrer.
                        </small>
                      </div>
                    )}
                  </div>
                  {draftContentIssues.length > 0 && (
                    <ul>
                      {draftContentIssues.map((issue) => (
                        <li key={issue.code} className={issue.level}>
                          {issue.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {draftCategory?.kind === "shop" &&
                productDraft.id &&
                shopContentReviewCount > 0 && (
                  <div className="content-review-nav-v453">
                    <div>
                      <span>FILE DE RÉVISION</span>
                      <strong>
                        {isFinalReviewProduct
                          ? "Dernier produit à revoir"
                          : currentReviewIndex >= 0
                            ? `Produit ${currentReviewIndex + 1} sur ${shopContentReviewCount}`
                            : `${shopContentReviewCount} produit${shopContentReviewCount > 1 ? "s" : ""} restant${shopContentReviewCount > 1 ? "s" : ""}`}
                      </strong>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="button ghost small"
                        disabled={!previousReviewProduct}
                        onClick={() =>
                          previousReviewProduct &&
                          chooseProduct(previousReviewProduct)
                        }
                      >
                        ← Précédent
                      </button>
                      <button
                        type="button"
                        className="button ghost small"
                        disabled={
                          !nextReviewProduct ||
                          nextReviewProduct.id === productDraft.id
                        }
                        onClick={() =>
                          nextReviewProduct &&
                          chooseProduct(nextReviewProduct)
                        }
                      >
                        Suivant à revoir →
                      </button>
                    </div>
                  </div>
                )}

              {draftCategory?.kind === "shop" && (
                <p className="product-editor-seo-note-v477">
                  L’audit SEO global reste disponible dans Pilotage → SEO. Cette
                  fiche utilise ici les mêmes données produit sans dupliquer le
                  dashboard V475.
                </p>
              )}
            </section>

            <section
              className="product-editor-section-v477"
              id="product-editor-advanced-v477"
            >
              <div className="product-editor-section-head-v477">
                <div>
                  <span>06</span>
                  <div>
                    <h3>Avancé</h3>
                    <p>
                      Paramètres rarement modifiés et action destructive.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-grid three">
                <label>
                  Ordre
                  <input
                    type="number"
                    value={productDraft.sort_order}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        sort_order: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Slug
                  <input
                    value={productDraft.slug}
                    onChange={(e) =>
                      setProductDraft({
                        ...productDraft,
                        slug: e.target.value,
                      })
                    }
                    placeholder="automatique si vide"
                  />
                  <small>
                    URL publique :{" "}
                    {productDraft.slug.trim()
                      ? `/boutique/${productDraft.slug.trim()}`
                      : "générée à l’enregistrement"}
                  </small>
                </label>
              </div>

              {productDraft.id && (
                <div className="product-editor-danger-v477">
                  <div>
                    <strong>Supprimer définitivement</strong>
                    <span>
                      À utiliser uniquement si ce produit doit réellement
                      disparaître du catalogue.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button danger small"
                    onClick={() => deleteProduct(productDraft.id)}
                  >
                    Supprimer le produit
                  </button>
                </div>
              )}
            </section>

            <div className="drawer-save-bar product-editor-savebar-v477">
              <div className="product-editor-save-status-v477">
                <button
                  type="button"
                  className="button ghost"
                  onClick={closeEditor}
                >
                  ← Fermer
                </button>
                <span
                  className={
                    draftDirty
                      ? "product-editor-dirty-v477"
                      : "product-editor-clean-v477"
                  }
                >
                  {draftDirty
                    ? "● Modifications non enregistrées"
                    : productDraft.id
                      ? "✓ À jour"
                      : "Nouveau brouillon"}
                </span>
                {message && <small>{message}</small>}
              </div>

              {draftCategory?.kind === "shop" &&
              productDraft.id &&
              reviewAdvanceProduct ? (
                <div className="drawer-save-actions-v454">
                  <button type="submit" className="button ghost" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={saving || draftContentIssues.length > 0}
                    title={
                      draftContentIssues.length > 0
                        ? "Corrigez les points à vérifier avant de passer automatiquement au suivant."
                        : `Enregistrer puis ouvrir ${reviewAdvanceProduct.name_fr}`
                    }
                    onClick={() => void saveAndOpenNextReview()}
                  >
                    {saving
                      ? "Enregistrement…"
                      : "Enregistrer et suivant →"}
                  </button>
                </div>
              ) : draftCategory?.kind === "shop" &&
                productDraft.id &&
                isFinalReviewProduct ? (
                <div className="drawer-save-actions-v454 drawer-save-actions-v455-finish">
                  <button type="submit" className="button ghost" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={saving || draftContentIssues.length > 0}
                    title={
                      draftContentIssues.length > 0
                        ? "Corrigez les derniers points avant de terminer la révision."
                        : "Enregistrer puis terminer la file de révision"
                    }
                    onClick={() => void saveAndFinishReview()}
                  >
                    {saving
                      ? "Enregistrement…"
                      : "Enregistrer et terminer ✓"}
                  </button>
                </div>
              ) : (
                <button className="button primary" disabled={saving}>
                  {saving
                    ? "Enregistrement…"
                    : "Enregistrer et continuer"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>}

    </div>
  );
}
