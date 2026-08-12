"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ProductGalleryAdmin } from "./ProductGalleryAdmin";
import type { Category, ProductType, Variant } from "@/lib/types";
import { siteSettingDefaults } from "@/lib/settings";
import { PromotionsAdmin } from "./PromotionsAdmin";
import { InvoiceSettingsAdmin } from "./InvoiceSettingsAdmin";
import { ProductionAdmin } from "./ProductionAdmin";
import { AdminMessages, type AdminContactMessage } from "./admin/AdminMessages";
import { CategoryAdmin, VariantEditor } from "./admin/AdminCatalogEditors";
import { SettingsAdmin } from "./admin/AdminSettings";
import { AdminOrders } from "./admin/AdminOrders";
import {
  blankProduct,
  inferProductPreset,
  slugify,
  type AdminProduct,
} from "./admin/catalog-model";

type Tab = "products" | "categories" | "orders" | "promos" | "messages" | "invoices" | "settings" | "system";



export function AdminDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [orderPendingCount, setOrderPendingCount] = useState(0);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [contactMessages, setContactMessages] = useState<AdminContactMessage[]>([]);
  const [contactFilter, setContactFilter] = useState<"new" | "all" | "archived">("new");
  const [contactSearch, setContactSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [productDraft, setProductDraft] = useState<AdminProduct>(blankProduct);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({ ...siteSettingDefaults });
  const [catalogZone, setCatalogZone] = useState<"menu" | "shop">("menu");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [quickSavingId, setQuickSavingId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setReady(true); return; }
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) return router.replace("/admin/login");
      const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userResult.user.id).maybeSingle();
      if (!admin) { await supabase.auth.signOut(); return router.replace("/admin/login"); }
      await Promise.all([loadProducts(), loadCategories(), loadMessages(), loadSettings()]);
      setReady(true);
    }
    init();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProducts() {
    if (!supabase) return;
    const [{ data: productRows }, { data: variantRows }] = await Promise.all([
      supabase.from("products").select("*").order("sort_order"),
      supabase.from("product_variants").select("*").order("sort_order"),
    ]);
    setProducts((productRows ?? []) as AdminProduct[]);
    setVariants((variantRows ?? []) as Variant[]);
  }
  async function loadCategories() { if (!supabase) return; const { data } = await supabase.from("categories").select("*").order("kind").order("sort_order"); setCategories((data ?? []) as Category[]); }
  async function loadMessages() {
    if (!supabase) return;
    const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) { console.warn("Contact messages unavailable", error.message); return setContactMessages([]); }
    setContactMessages((data ?? []) as AdminContactMessage[]);
  }
  async function updateContactStatus(id: string, status: AdminContactMessage["status"]) {
    if (!supabase) return;
    const { error } = await supabase.from("contact_messages").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return window.alert(error.message);
    await loadMessages();
  }
  async function loadSettings() { if (!supabase) return; const { data } = await supabase.from("site_settings").select("key,value"); const values = Object.fromEntries((data ?? []).map((row) => [row.key, typeof row.value === "string" ? row.value : String(row.value ?? "")])); setSettings({ ...siteSettingDefaults, ...values }); }
  function chooseProduct(product?: AdminProduct, zone: "menu" | "shop" = catalogZone, preferredCategoryId?: string) {
    setMessage("");
    setAdvancedOpen(true);
    if (!product) {
      const preferredCategory = preferredCategoryId ? categories.find((category) => category.id === preferredCategoryId && category.kind === zone) : undefined;
      const firstCategory = preferredCategory ?? categories.find((category) => category.kind === zone && category.active) ?? categories.find((category) => category.kind === zone);
      const preset = inferProductPreset(firstCategory, zone);
      setSelectedId("new");
      setProductDraft({
        ...blankProduct,
        category_id: firstCategory?.id ?? "",
        type: preset.type,
        pickup_only: preset.pickup_only,
        stock: preset.stock,
        shipping_weight_g: preset.shipping_weight_g,
        active: false,
        sort_order: firstCategory ? products.filter((item) => item.category_id === firstCategory.id).length + 1 : 1,
      });
      return;
    }
    const kind = categories.find((category) => category.id === product.category_id)?.kind;
    if (kind === "menu" || kind === "shop") setCatalogZone(kind);
    setSelectedId(product.id);
    setProductDraft({ ...product, ideal_for: product.ideal_for ?? [] });
  }

  function changeDraftCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);
    if (!category || productDraft.id) {
      setProductDraft((current) => ({ ...current, category_id: categoryId }));
      return;
    }
    const preset = inferProductPreset(category, category.kind);
    setCatalogZone(category.kind);
    setProductDraft((current) => ({
      ...current,
      category_id: categoryId,
      type: preset.type,
      pickup_only: preset.pickup_only,
      stock: preset.stock,
      shipping_weight_g: preset.shipping_weight_g,
      sort_order: products.filter((item) => item.category_id === categoryId).length + 1,
    }));
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault(); if (!supabase) return; setSaving(true); setMessage("");
    const payload = {
      slug: productDraft.slug || slugify(productDraft.name_fr), category_id: productDraft.category_id, type: productDraft.type,
      name_fr: productDraft.name_fr, name_en: productDraft.name_en || productDraft.name_fr, description_fr: productDraft.description_fr,
      description_en: productDraft.description_en || productDraft.description_fr,
      long_description_fr: productDraft.long_description_fr?.trim() || productDraft.description_fr || null,
      long_description_en: productDraft.long_description_en?.trim() || productDraft.description_en || productDraft.description_fr || null,
      origin: productDraft.origin || null, cultivar: productDraft.cultivar || null,
      badge: productDraft.badge || null, base_price: Number(productDraft.base_price), stock: Number(productDraft.stock),
      pickup_only: productDraft.pickup_only, active: productDraft.active, featured: productDraft.featured,
      sort_order: Number(productDraft.sort_order), image_url: productDraft.image_url || null, ideal_for: productDraft.ideal_for.filter(Boolean), shipping_weight_g: Number(productDraft.shipping_weight_g || 0),
    };

    if (productDraft.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", productDraft.id);
      setSaving(false);
      if (error) return setMessage(error.message);
      setMessage("Enregistré ✓");
      await loadProducts();
      setProductDraft((current) => ({ ...current, ...payload }));
      return;
    }

    const { data, error } = await supabase.from("products").insert(payload).select("*").single();
    setSaving(false);
    if (error || !data) return setMessage(error?.message ?? "Création impossible.");
    setMessage("Enregistré ✓");
    await loadProducts();
    chooseProduct(data as AdminProduct);
  }


  async function deleteProduct(id: string) {
    if (!supabase || !window.confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return setMessage(error.message);
    setSelectedId(""); setProductDraft(blankProduct); await loadProducts();
  }

  async function quickPatchProduct(id: string, patch: Partial<AdminProduct>) {
    if (!supabase) return;
    setQuickSavingId(id);
    setMessage("");
    const cleanPatch: Record<string, unknown> = { ...patch };
    if ("base_price" in patch) cleanPatch.base_price = Number(patch.base_price);
    if ("stock" in patch) cleanPatch.stock = Number(patch.stock);
    if ("shipping_weight_g" in patch) cleanPatch.shipping_weight_g = Number(patch.shipping_weight_g || 0);
    if ("sort_order" in patch) cleanPatch.sort_order = Number(patch.sort_order);
    const { error } = await supabase.from("products").update(cleanPatch).eq("id", id);
    setQuickSavingId("");
    if (error) { setMessage(error.message); await loadProducts(); return; }
    setProducts((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
    if (productDraft.id === id) setProductDraft((current) => ({ ...current, ...patch }));
  }

  async function duplicateProduct(product: AdminProduct) {
    if (!supabase) return;
    setQuickSavingId(product.id);
    const payload = {
      slug: `${product.slug}-copie-${Date.now().toString().slice(-6)}`,
      category_id: product.category_id, type: product.type, name_fr: `${product.name_fr} — copie`, name_en: `${product.name_en || product.name_fr} — copy`,
      description_fr: product.description_fr, description_en: product.description_en, long_description_fr: product.long_description_fr, long_description_en: product.long_description_en, origin: product.origin, cultivar: product.cultivar, badge: product.badge,
      base_price: Number(product.base_price), stock: Number(product.stock), pickup_only: product.pickup_only, active: false, featured: false,
      sort_order: products.filter((item) => item.category_id === product.category_id).length + 1, image_url: product.image_url, ideal_for: product.ideal_for ?? [], shipping_weight_g: Number(product.shipping_weight_g || 0),
    };
    const { data: created, error } = await supabase.from("products").insert(payload).select("*").single();
    if (error || !created) { setQuickSavingId(""); return setMessage(error?.message ?? "Duplication impossible."); }
    const sourceVariants = variants.filter((variant) => variant.product_id === product.id);
    if (sourceVariants.length) {
      await supabase.from("product_variants").insert(sourceVariants.map((variant, variantIndex) => ({ product_id: created.id, name: variant.name, packaging: variant.packaging, weight: variant.weight, price: Number(variant.price), stock: Number(variant.stock), active: variant.active, sort_order: variantIndex + 1, image_url: variant.image_url ?? null, shipping_weight_g: Number(variant.shipping_weight_g || 0) })));
    }
    setQuickSavingId("");
    setMessage("Produit dupliqué ✓ — il est masqué par défaut.");
    await loadProducts();
  }

  async function moveProduct(product: AdminProduct, direction: -1 | 1) {
    if (!supabase) return;
    const ordered = products.filter((item) => item.category_id === product.category_id).sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));
    const index = ordered.findIndex((item) => item.id === product.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;
    setQuickSavingId(product.id);
    const currentOrder = product.sort_order;
    const neighborOrder = neighbor.sort_order;
    const fallbackBase = index * 10 + 10;
    await Promise.all([
      supabase.from("products").update({ sort_order: neighborOrder === currentOrder ? fallbackBase + direction : neighborOrder }).eq("id", product.id),
      supabase.from("products").update({ sort_order: neighborOrder === currentOrder ? fallbackBase : currentOrder }).eq("id", neighbor.id),
    ]);
    setQuickSavingId("");
    await loadProducts();
  }

  async function addVariant() {
    if (!supabase || !productDraft.id) return setMessage("Enregistrez d’abord le produit.");
    const productVariants = variants.filter((v) => v.product_id === productDraft.id);
    const { error } = await supabase.from("product_variants").insert({
      product_id: productDraft.id,
      name: `Nouveau format ${productVariants.length + 1}`,
      packaging: "can",
      weight: "",
      price: productDraft.base_price,
      stock: 0,
      active: false,
      shipping_weight_g: Number(productDraft.shipping_weight_g || 0),
      sort_order: productVariants.length + 1,
    });
    if (error) return setMessage(error.message);
    setMessage("Nouveau format ajouté. Complétez-le puis activez-le ✓");
    await loadProducts();
  }

  async function saveVariant(variant: Variant) {
    if (!supabase) return;
    const signature = `${variant.packaging ?? "other"}|${String(variant.weight ?? "").trim().toLowerCase()}|${String(variant.name ?? "").trim().toLowerCase()}`;
    const duplicate = variants.some((item) => item.product_id === variant.product_id && item.id !== variant.id && `${item.packaging ?? "other"}|${String(item.weight ?? "").trim().toLowerCase()}|${String(item.name ?? "").trim().toLowerCase()}` === signature);
    if (duplicate) return setMessage("Ce modèle existe déjà : changez le conditionnement, le poids ou le nom.");
    if (!String(variant.name ?? "").trim() && !String(variant.weight ?? "").trim()) return setMessage("Ajoutez au moins un nom de modèle ou un poids.");
    const { error } = await supabase.from("product_variants").update({
      name: String(variant.name || variant.weight || "Format").trim(),
      packaging: variant.packaging,
      weight: variant.weight || null,
      price: Number(variant.price),
      stock: Number(variant.stock),
      active: variant.active,
      shipping_weight_g: Number(variant.shipping_weight_g || 0),
    }).eq("id", variant.id);
    setMessage(error ? error.message : "Format enregistré ✓");
    if (!error) await loadProducts();
  }


  async function deleteVariant(id: string) { if (!supabase || !window.confirm("Supprimer ce format ?")) return; await supabase.from("product_variants").delete().eq("id", id); await loadProducts(); }
  async function logout() { if (supabase) await supabase.auth.signOut(); router.replace("/admin/login"); }

  if (!ready) return <section className="admin-shell"><div className="loading-card">Chargement de l’administration…</div></section>;
  if (!supabase) return <section className="admin-shell"><div className="setup-warning"><h1>Supabase à connecter</h1><p>Le code est prêt. Ajoutez les clés dans <code>.env.local</code> et exécutez <code>supabase/schema.sql</code>.</p></div></section>;

  const selectedVariants = variants.filter((variant) => variant.product_id === productDraft.id);
  const labels: Record<Tab, string> = { products: "Catalogue", categories: "Catégories", orders: "Commandes", promos: "Promotions", messages: "Messages", invoices: "Facturation", settings: "Réglages", system: "Système" };
  const newContactCount = contactMessages.filter((item) => item.status === "new").length;

  const categoryById = new Map<string, Category>(categories.map((category) => [category.id, category]));
  const draftCategory = categoryById.get(productDraft.category_id);
  const draftPreset = !productDraft.id && draftCategory ? inferProductPreset(draftCategory, draftCategory.kind) : null;
  const catalogCategories = categories.filter((category) => category.kind === catalogZone);
  const normalizedCatalogSearch = catalogSearch.trim().toLowerCase();
  const catalogProducts = products
    .filter((product) => categoryById.get(product.category_id)?.kind === catalogZone)
    .filter((product) => !normalizedCatalogSearch || `${product.name_fr} ${product.name_en} ${product.badge ?? ""} ${categoryById.get(product.category_id)?.name_fr ?? ""}`.toLowerCase().includes(normalizedCatalogSearch))
    .sort((a, b) => a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr));
  const catalogCounts = { menu: products.filter((product) => categoryById.get(product.category_id)?.kind === "menu").length, shop: products.filter((product) => categoryById.get(product.category_id)?.kind === "shop").length };
  const catalogCategoryGroups = catalogCategories.map((category) => ({
    category,
    products: catalogProducts.filter((product) => product.category_id === category.id),
    totalCount: products.filter((product) => product.category_id === category.id).length,
  })).filter((group) => !normalizedCatalogSearch || group.products.length > 0);

  function renderQuickProductRow(product: AdminProduct, index: number, orderedProducts: AdminProduct[]) {
    const productVariants = variants.filter((variant) => variant.product_id === product.id);
    const totalVariantStock = productVariants.filter((variant) => variant.active).reduce((sum, variant) => sum + Math.max(0, Number(variant.stock)), 0);
    return <article className={`quick-product-row zone-${catalogZone} ${!product.active ? "is-hidden" : ""}`} key={product.id}>
      <div className="quick-product-image"><img src={product.image_url || "/product-placeholder.svg"} alt="" /><button type="button" className={product.featured ? "featured active" : "featured"} title="Mettre en avant" onClick={() => quickPatchProduct(product.id, { featured: !product.featured })}>★</button></div>
      <div className="quick-product-main">
        <div className="quick-name-line"><input aria-label="Nom du produit" value={product.name_fr} onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, name_fr: e.target.value } : item))} onBlur={() => quickPatchProduct(product.id, { name_fr: product.name_fr, name_en: product.name_en || product.name_fr })} /><span className={`visibility-dot ${product.active ? "on" : "off"}`}></span></div>
        <div className="quick-meta-line"><select aria-label="Catégorie" value={product.category_id} onChange={(e) => quickPatchProduct(product.id, { category_id: e.target.value })}>{catalogCategories.map((item) => <option key={item.id} value={item.id}>{item.name_fr}</option>)}</select>{productVariants.length ? <button type="button" className="mini-chip" onClick={() => chooseProduct(product)}>{productVariants.length} format{productVariants.length > 1 ? "s" : ""}</button> : <span className="mini-chip subtle">Sans variante</span>}{product.badge && <span className="mini-chip">{product.badge}</span>}</div>
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

  return <section className="admin-shell">
    <header className="admin-top"><div><p className="eyebrow">ICHIGO ICHIE</p><h1>Administration</h1></div><div><a className="button ghost small" href="/" target="_blank">Voir le site ↗</a><button className="button ghost small" onClick={logout}>Déconnexion</button></div></header>
    <nav className="admin-nav-v241" aria-label="Navigation administration">
      <div className="admin-nav-group-v241 admin-nav-operations-v241">
        <span className="admin-nav-group-label-v241">Opérations</span>
        <div className="admin-nav-buttons-v241">
          {(["orders", "messages"] as Tab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{labels[name]}{name === "orders" && orderPendingCount ? <span>{orderPendingCount}</span> : name === "messages" && newContactCount ? <span>{newContactCount}</span> : null}</button>)}
        </div>
      </div>
      <div className="admin-nav-separator-v241" aria-hidden="true"></div>
      <div className="admin-nav-group-v241 admin-nav-management-v241">
        <span className="admin-nav-group-label-v241">Gestion</span>
        <div className="admin-nav-buttons-v241">
          {(["products", "categories", "promos", "invoices", "settings"] as Tab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{labels[name]}{name === "settings" && settingsDirty ? <i className="cms-dirty-tab-dot-v229" title="Modifications non enregistrées" aria-label="Modifications non enregistrées">•</i> : null}</button>)}
        </div>
      </div>
      <div className="admin-nav-separator-v241" aria-hidden="true"></div>
      <div className="admin-nav-group-v241 admin-nav-system-v246">
        <span className="admin-nav-group-label-v241">Système</span>
        <div className="admin-nav-buttons-v241">
          <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>{labels.system}</button>
        </div>
      </div>
    </nav>

    {tab === "products" && <div className="quick-catalog-admin">
      <div className="quick-catalog-toolbar">
        <div className="catalog-zone-switch" role="tablist" aria-label="Zone du catalogue">
          <button type="button" className={catalogZone === "menu" ? "active" : ""} onClick={() => { setCatalogZone("menu"); setAdvancedOpen(false); }}><span>Menu</span><strong>{catalogCounts.menu}</strong></button>
          <button type="button" className={catalogZone === "shop" ? "active" : ""} onClick={() => { setCatalogZone("shop"); setAdvancedOpen(false); }}><span>Boutique</span><strong>{catalogCounts.shop}</strong></button>
        </div>
        <div className="quick-catalog-actions"><input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder={`Rechercher dans ${catalogZone === "menu" ? "le menu" : "la boutique"}…`} /><button className="button primary small" type="button" onClick={() => chooseProduct(undefined, catalogZone)}>+ Ajouter</button></div>
      </div>
      <div className="quick-admin-hint"><strong>Modification rapide</strong><span>Prix, stock, poids, visibilité et ordre se modifient directement ici. Ouvrez “Détails” uniquement pour les descriptions, images, options ou variantes.</span>{quickSavingId && <em>Enregistrement…</em>}</div>
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
        <div className="quick-detail-backdrop" onClick={() => setAdvancedOpen(false)}></div>
        <div className="quick-detail-drawer" role="dialog" aria-modal="true" aria-label="Détails du produit">
          <form onSubmit={saveProduct}>
            <div className="editor-head sticky-editor-head"><div><p className="eyebrow">{productDraft.id ? "DÉTAILS" : "NOUVEAU"}</p><h2>{productDraft.name_fr || (catalogZone === "menu" ? "Nouvel article du menu" : "Nouveau produit boutique")}</h2></div><div><button type="button" className="button ghost small" onClick={() => setAdvancedOpen(false)}>Fermer</button>{productDraft.id && <button type="button" className="button danger small" onClick={() => deleteProduct(productDraft.id)}>Supprimer</button>}<button className="button primary small" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button></div></div>
            {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}
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
            <details className="admin-details" open={categoryById.get(productDraft.category_id)?.kind === "menu"}><summary>Photos</summary><div className="editor-section"><ProductGalleryAdmin productId={productDraft.id} productName={productDraft.name_fr || "Produit"} fallbackImageUrl={productDraft.image_url} onMainImageChange={(url) => setProductDraft((current) => ({ ...current, image_url: url }))} /></div></details>
            {categoryById.get(productDraft.category_id)?.kind === "shop" && <details className="admin-details" open={selectedVariants.length > 0}><summary>Formats / variantes {selectedVariants.length ? `(${selectedVariants.length})` : ""}</summary><div className="editor-section"><div className="section-inline"><div><p className="muted">Créez autant de modèles que nécessaire : Boîte 30 g, Sachet 30 g, Boîte 100 g… Chaque modèle a son prix, son stock et son poids d’expédition. Les 3 photos sont communes au produit.</p><small className="muted">Un nouveau format est créé masqué : complétez-le puis cochez « Actif ».</small></div><button type="button" onClick={addVariant}>+ Ajouter un modèle</button></div>{!productDraft.id ? <p className="muted">Enregistrez d’abord le produit.</p> : selectedVariants.length ? <div className="variant-admin-list">{selectedVariants.map((variant) => <VariantEditor key={variant.id} variant={variant} onChange={(next) => setVariants((current) => current.map((v) => v.id === next.id ? next : v))} onSave={saveVariant} onDelete={deleteVariant} />)}</div> : <p className="muted">Aucun modèle. Le prix de base sera utilisé.</p>}</div></details>}
            <details className="admin-details"><summary>Affichage avancé</summary><div className="editor-section"><div className="form-grid three"><label>Ordre<input type="number" value={productDraft.sort_order} onChange={(e) => setProductDraft({ ...productDraft, sort_order: Number(e.target.value) })} /></label><label>Slug<input value={productDraft.slug} onChange={(e) => setProductDraft({ ...productDraft, slug: e.target.value })} placeholder="automatique si vide" /></label></div></div></details>
            <div className="drawer-save-bar"><span>{message || "Les changements rapides de la liste sont sauvegardés automatiquement."}</span><button className="button primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer et continuer"}</button></div>
          </form>
        </div>
      </div>}
    </div>}

    {tab === "categories" && <CategoryAdmin categories={categories} supabase={supabase} reload={loadCategories} />}
    {tab === "orders" && (
      <AdminOrders
        supabase={supabase}
        refreshKey={ordersRefreshKey}
        onPendingCountChange={setOrderPendingCount}
      />
    )}
    {tab === "promos" && <PromotionsAdmin supabase={supabase} />}
    {tab === "invoices" && <InvoiceSettingsAdmin supabase={supabase} />}
    {tab === "system" && <ProductionAdmin supabase={supabase} onOrdersChanged={() => setOrdersRefreshKey((current) => current + 1)} />}
    {tab === "messages" && (
      <AdminMessages
        messages={contactMessages}
        filter={contactFilter}
        search={contactSearch}
        onFilterChange={setContactFilter}
        onSearchChange={setContactSearch}
        onRefresh={loadMessages}
        onStatusChange={updateContactStatus}
      />
    )}
    <div className={tab === "settings" ? "admin-settings-host-v229 is-active" : "admin-settings-host-v229"}><SettingsAdmin settings={settings} setSettings={setSettings} supabase={supabase} reload={loadSettings} active={tab === "settings"} onDirtyChange={setSettingsDirty} /></div>
  </section>;
}
