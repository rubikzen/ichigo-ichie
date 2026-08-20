"use client";

import { useState } from "react";
import { ProductGalleryAdmin } from "../ProductGalleryAdmin";
import { SafeImage } from "../SafeImage";
import type { Category, ProductType } from "@/lib/types";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { VariantEditor } from "./AdminCatalogEditors";
import { RestockWaitlistAdmin } from "./RestockWaitlistAdmin";
import { inferProductPreset, type AdminProduct } from "./catalog-model";
import {
  applySafeContentQualityFixes,
  auditProductContent,
  safeContentFixCount,
} from "@/lib/product-content";
import { useAdminCatalog } from "./useAdminCatalog";

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
  const shopProducts = products.filter((product) => categoryById.get(product.category_id)?.kind === "shop");
  const shopContentReviewCount = shopProducts.filter((product) => productContentIssues(product).length > 0).length;
  const draftCategory = categoryById.get(productDraft.category_id);
  const draftPreset = !productDraft.id && draftCategory ? inferProductPreset(draftCategory, draftCategory.kind) : null;
  const draftContentIssues = draftCategory?.kind === "shop" ? auditProductContent({ ...productDraft, kind: "shop" }) : [];
  const draftSafeFixCount = draftCategory?.kind === "shop" ? safeContentFixCount({ ...productDraft, kind: "shop" }) : 0;
  const draftHasShortEnLanguageWarning = draftContentIssues.some((issue) => issue.code === "short_en_likely_fr");
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

  function renderQuickProductRow(product: AdminProduct, index: number, orderedProducts: AdminProduct[]) {
    const productVariants = variants.filter((variant) => variant.product_id === product.id);
    const totalVariantStock = productVariants.filter((variant) => variant.active).reduce((sum, variant) => sum + Math.max(0, Number(variant.stock)), 0);
    const contentIssues = catalogZone === "shop" ? productContentIssues(product) : [];
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
      <button type="button" className={`quick-visibility ${product.active ? "active" : ""}`} onClick={() => quickPatchProduct(product.id, { active: !product.active })}>{product.active ? "Visible" : "Masqué"}</button>
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
        <div className="quick-catalog-actions"><input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder={`Rechercher dans ${catalogZone === "menu" ? "le menu" : "la boutique"}…`} />{catalogZone === "shop" && <button className={`button ghost small content-quality-filter-v451 ${contentQualityOnly ? "active" : ""}`} type="button" aria-pressed={contentQualityOnly} onClick={() => setContentQualityOnly((current) => !current)}>{contentQualityOnly ? "Afficher tout" : `À revoir · ${shopContentReviewCount}`}</button>}<button className="button primary small" type="button" onClick={() => chooseProduct(undefined, catalogZone)}>+ Ajouter</button></div>
      </div>
      <div className="quick-admin-hint"><strong>Modification rapide</strong><span>Prix, stock, poids, visibilité et ordre se modifient directement ici. Ouvrez “Détails” uniquement pour les descriptions, images, options ou variantes.</span>{catalogZone === "shop" && <span className={`content-quality-summary-v451 ${shopContentReviewCount ? "needs-review" : "ready"}`}>{shopContentReviewCount ? `${shopContentReviewCount} produit${shopContentReviewCount > 1 ? "s" : ""} à revoir` : "Contenu Boutique prêt ✓"}</span>}{quickSavingId && <em>Enregistrement…</em>}</div>
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

      {catalogZone === "shop" && (
        <RestockWaitlistAdmin
          supabase={supabase}
          products={products}
          variants={variants}
        />
      )}

      {advancedOpen && selectedId && <div className="quick-detail-panel">
        <div className="quick-detail-backdrop" onClick={() => setAdvancedOpen(false)}></div>
        <div className="quick-detail-drawer" role="dialog" aria-modal="true" aria-label="Détails du produit">
          <form onSubmit={saveProduct}>
            <div className="editor-head sticky-editor-head"><div><p className="eyebrow">{productDraft.id ? "DÉTAILS" : "NOUVEAU"}</p><h2>{productDraft.name_fr || (catalogZone === "menu" ? "Nouvel article du menu" : "Nouveau produit boutique")}</h2></div><div><button type="button" className="button ghost small" onClick={() => setAdvancedOpen(false)}>Fermer</button>{productDraft.id && <button type="button" className="button danger small" onClick={() => deleteProduct(productDraft.id)}>Supprimer</button>}<button className="button primary small" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button></div></div>
            {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}
            {draftCategory?.kind === "shop" && <div className={`content-quality-panel-v451 ${draftContentIssues.length ? "needs-review" : "ready"}`}><div><span className="content-quality-kicker-v451">QUALITÉ DU CONTENU</span><strong>{draftContentIssues.length ? `${draftContentIssues.length} point${draftContentIssues.length > 1 ? "s" : ""} à vérifier` : "Contenu prêt ✓"}</strong><p>{draftContentIssues.length ? "Corrigez les points signalés avant de publier ou lors de la prochaine mise à jour." : "Descriptions et informations essentielles sont cohérentes."}</p>{draftContentIssues.length > 0 && <div className="content-quality-actions-v452">{draftSafeFixCount > 0 && <button type="button" className="button ghost small" onClick={applySafeEditorialFixes}>Appliquer {draftSafeFixCount} correction{draftSafeFixCount > 1 ? "s" : ""} sûre{draftSafeFixCount > 1 ? "s" : ""}</button>}{draftHasShortEnLanguageWarning && <button type="button" className="button ghost small" onClick={useFrenchFallbackForShortEnglish}>Utiliser le fallback FR pour EN</button>}<small>Le brouillon est seulement prérempli : vérifiez les champs puis cliquez sur Enregistrer.</small></div>}</div>{draftContentIssues.length > 0 && <ul>{draftContentIssues.map((issue) => <li key={issue.code} className={issue.level}>{issue.label}</li>)}</ul>}</div>}
            {!productDraft.id && draftPreset && <div className="smart-add-banner">
              <div><span className="smart-add-kicker">Préconfiguration automatique</span><strong>{draftCategory?.name_fr}</strong><p>{draftPreset.note}</p></div>
              <div className="smart-add-chips"><span>{draftPreset.title}</span><span>{draftPreset.fulfillment}</span><span>{catalogZone === "menu" ? "Sans stock" : "Stock à renseigner"}</span><span className="draft-chip">Brouillon masqué</span></div>
            </div>}
            <div className="editor-section compact-section"><h3>Essentiel</h3><div className="form-grid three"><label>Nom FR<input value={productDraft.name_fr} onChange={(e) => setProductDraft({ ...productDraft, name_fr: e.target.value })} required /></label><label>Nom EN <small>(facultatif, FR utilisé si vide)</small><input value={productDraft.name_en} onChange={(e) => setProductDraft({ ...productDraft, name_en: e.target.value })} /></label><label>Type {draftPreset && <small>(pré-rempli)</small>}<select value={productDraft.type} onChange={(e) => setProductDraft({ ...productDraft, type: e.target.value as ProductType })}><option value="drink">Boisson</option><option value="dessert">Dessert</option><option value="product">Matcha / produit</option><option value="accessory">Accessoire</option><option value="combo">Combo</option></select></label><label>Catégorie<select value={productDraft.category_id} onChange={(e) => changeDraftCategory(e.target.value)} required><option value="">—</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.kind === "menu" ? "Carte · " : "Boutique · "}{category.name_fr}</option>)}</select></label><label>Prix (€)<input type="number" min="0" step="0.01" value={productDraft.base_price} onChange={(e) => setProductDraft({ ...productDraft, base_price: Number(e.target.value) })} /></label>{categoryById.get(productDraft.category_id)?.kind === "shop" && selectedVariants.length === 0 && <label>Stock<input type="number" min="0" value={productDraft.stock} onChange={(e) => setProductDraft({ ...productDraft, stock: Number(e.target.value) })} /><small>Utilisé uniquement si le produit n’a pas de modèle.</small></label>}{categoryById.get(productDraft.category_id)?.kind === "shop" && <label>Poids expédition (g)<input type="number" min="0" value={productDraft.shipping_weight_g ?? 0} onChange={(e) => setProductDraft({ ...productDraft, shipping_weight_g: Number(e.target.value) })} /><small>Article seul, hors carton commun.</small></label>}<label>Badge<input value={productDraft.badge ?? ""} onChange={(e) => setProductDraft({ ...productDraft, badge: e.target.value })} placeholder="Signature, Nouveau…" /></label></div><div className="quick-boolean-grid"><label className="check-label"><input type="checkbox" checked={productDraft.active} onChange={(e) => setProductDraft({ ...productDraft, active: e.target.checked })} /> Visible</label><label className="check-label"><input type="checkbox" checked={productDraft.featured} onChange={(e) => setProductDraft({ ...productDraft, featured: e.target.checked })} /> Mis en avant</label>{categoryById.get(productDraft.category_id)?.kind === "shop" && <label className="check-label"><input type="checkbox" checked={productDraft.pickup_only} onChange={(e) => setProductDraft({ ...productDraft, pickup_only: e.target.checked })} /> Retrait uniquement</label>}</div>{categoryById.get(productDraft.category_id)?.kind === "menu" && <p className="menu-admin-note-v227">Article informatif uniquement : aucune option, aucun stock et aucune commande en ligne.</p>}</div>
            <details className="admin-details" open={!productDraft.id}><summary>Descriptions & informations</summary><div className="editor-section description-editor-v27">
              <div className="description-help"><div><strong>Texte court = carte</strong><span>{categoryById.get(productDraft.category_id)?.kind === "menu" ? "Gardez 1–3 phrases : c’est tout ce que le visiteur voit sur la carte." : "Gardez 1–3 phrases. Le texte long apparaît dans la fiche Boutique."}</span></div><span className={productDraft.description_fr.length > 180 ? "description-count warning" : "description-count"}>{productDraft.description_fr.length}/180 conseillé</span></div>
              <div className="form-grid">
                <label>Description courte FR<textarea rows={3} maxLength={260} value={productDraft.description_fr} onChange={(e) => setProductDraft({ ...productDraft, description_fr: e.target.value })} placeholder="Ex. Un matcha Uji doux, umami et équilibré, idéal en usucha ou latte." /><small>Utilisée sur la carte Boutique / Menu.</small></label>
                <label>Description courte EN <small>(facultatif)</small><textarea rows={3} maxLength={260} value={productDraft.description_en} onChange={(e) => setProductDraft({ ...productDraft, description_en: e.target.value })} placeholder="Short description shown on product cards." /><small>Si vide, le français est utilisé.</small></label>
              </div>
              {categoryById.get(productDraft.category_id)?.kind === "shop" && <>
                <div className="form-grid long-description-grid">
                  <label>Description complète FR<textarea rows={7} value={productDraft.long_description_fr ?? ""} onChange={(e) => setProductDraft({ ...productDraft, long_description_fr: e.target.value })} placeholder="Histoire du produit, profil aromatique, conseils, détails de préparation…" /><small>Visible uniquement dans la fiche produit.</small></label>
                  <label>Description complète EN <small>(facultatif)</small><textarea rows={7} value={productDraft.long_description_en ?? ""} onChange={(e) => setProductDraft({ ...productDraft, long_description_en: e.target.value })} placeholder="Full product description." /><small>Si vide, le texte court EN/FR est utilisé.</small></label>
                </div>
                <div className="description-actions"><button type="button" className="button ghost small" onClick={() => setProductDraft((current) => ({ ...current, long_description_fr: current.long_description_fr?.trim() ? current.long_description_fr : current.description_fr }))}>Utiliser le texte court comme base FR</button><button type="button" className="button ghost small" onClick={() => setProductDraft((current) => ({ ...current, long_description_en: current.long_description_en?.trim() ? current.long_description_en : (current.description_en || current.description_fr) }))}>Utiliser le texte court comme base EN</button></div>
                <div className="form-grid three"><label>Origine<input value={productDraft.origin ?? ""} onChange={(e) => setProductDraft({ ...productDraft, origin: e.target.value })} /></label><label>Cultivar / base<input value={productDraft.cultivar ?? ""} onChange={(e) => setProductDraft({ ...productDraft, cultivar: e.target.value })} /></label><label>Idéal pour<input value={productDraft.ideal_for.join(", ")} onChange={(e) => setProductDraft({ ...productDraft, ideal_for: e.target.value.split(",").map((v) => v.trim()) })} placeholder="Usucha, latte…" /></label></div>
              </>}
            </div></details>
            <details className="admin-details" open={categoryById.get(productDraft.category_id)?.kind === "menu"}><summary>Photos</summary><div className="editor-section"><ProductGalleryAdmin productId={productDraft.id} productName={productDraft.name_fr || "Produit"} catalogKind={categoryById.get(productDraft.category_id)?.kind ?? catalogZone} fallbackImageUrl={productDraft.image_url} onMainImageChange={(url) => setProductDraft((current) => ({ ...current, image_url: url }))} /></div></details>
            {categoryById.get(productDraft.category_id)?.kind === "shop" && <details className="admin-details" open={selectedVariants.length > 0}><summary>Formats / variantes {selectedVariants.length ? `(${selectedVariants.length})` : ""}</summary><div className="editor-section"><div className="section-inline"><div><p className="muted">Créez autant de modèles que nécessaire : Boîte 30 g, Sachet 30 g, Boîte 100 g… Chaque modèle a son prix, son stock et son poids d’expédition. Les 3 photos sont communes au produit.</p><small className="muted">Un nouveau format est créé masqué : complétez-le puis cochez « Actif ».</small></div><button type="button" onClick={addVariant}>+ Ajouter un modèle</button></div>{!productDraft.id ? <p className="muted">Enregistrez d’abord le produit.</p> : selectedVariants.length ? <div className="variant-admin-list">{selectedVariants.map((variant) => <VariantEditor key={variant.id} variant={variant} onChange={(next) => setVariants((current) => current.map((v) => v.id === next.id ? next : v))} onSave={saveVariant} onDelete={deleteVariant} />)}</div> : <p className="muted">Aucun modèle. Le prix de base sera utilisé.</p>}</div></details>}
            <details className="admin-details"><summary>Affichage avancé</summary><div className="editor-section"><div className="form-grid three"><label>Ordre<input type="number" value={productDraft.sort_order} onChange={(e) => setProductDraft({ ...productDraft, sort_order: Number(e.target.value) })} /></label><label>Slug<input value={productDraft.slug} onChange={(e) => setProductDraft({ ...productDraft, slug: e.target.value })} placeholder="automatique si vide" /></label></div></div></details>
            <div className="drawer-save-bar"><span>{message || "Les changements rapides de la liste sont sauvegardés automatiquement."}</span><button className="button primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer et continuer"}</button></div>
          </form>
        </div>
      </div>}
    </div>
  );
}
