"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { ProductGalleryAdmin } from "./ProductGalleryAdmin";
import type { Category, ProductType, Variant } from "@/lib/types";
import { siteSettingDefaults } from "@/lib/settings";
import { PromotionsAdmin } from "./PromotionsAdmin";
import { OrderStatistics } from "./OrderStatistics";
import { InvoiceSettingsAdmin } from "./InvoiceSettingsAdmin";
import { ProductionAdmin } from "./ProductionAdmin";
import { AdminMessages } from "./admin/AdminMessages";
import { CategoryAdmin, VariantEditor } from "./admin/AdminCatalogEditors";
import { SettingsAdmin } from "./admin/AdminSettings";

type AdminProduct = {
  id: string; slug: string; category_id: string; type: ProductType; name_fr: string; name_en: string;
  description_fr: string; description_en: string; long_description_fr: string | null; long_description_en: string | null; origin: string | null; cultivar: string | null; badge: string | null;
  base_price: number; stock: number; pickup_only: boolean; active: boolean; featured: boolean; sort_order: number;
  image_url: string | null; ideal_for: string[]; shipping_weight_g: number;
};
type OrderRow = { id: string; order_number: string; environment?: "test" | "live" | "legacy"; archived_at?: string | null; created_at: string; status: string; payment_status: string; payment_method?: "online" | "pickup"; source_channel?: "menu" | "shop" | "mixed"; order_type: "pickup" | "shipping"; customer_first_name: string; customer_last_name: string; customer_phone: string; customer_email: string; pickup_time: string | null; notes: string | null; subtotal: number; shipping_fee: number; total: number; shipping_method_name?: string | null; shipping_address1?: string | null; shipping_address2?: string | null; shipping_postal_code?: string | null; shipping_city?: string | null; shipping_country?: string | null; package_weight_g?: number | null; public_token?: string | null; tracking_carrier?: string | null; tracking_number?: string | null; tracking_url?: string | null; shipped_at?: string | null; stripe_refund_id?: string | null; promo_code?: string | null; discount_amount?: number | null; invoices?: Array<{ id: string; document_type: "invoice" | "credit_note"; document_number: string }>; order_items?: Array<{ id: string; product_name: string; quantity: number; line_total?: number; choices: Array<{ label?: string }> }> };
type ContactMessageRow = { id: string; created_at: string; updated_at?: string | null; status: "new" | "read" | "archived"; first_name: string; last_name: string; email: string; phone: string; message: string; locale?: "fr" | "en" };
type TrackingDraft = { carrier: string; number: string; url: string };
const TRACKING_CARRIERS = ["Colissimo", "Chronopost", "Mondial Relay", "DHL", "UPS", "Autre"] as const;
type Tab = "products" | "categories" | "orders" | "promos" | "messages" | "invoices" | "settings" | "system";

const blankProduct: AdminProduct = { id: "", slug: "", category_id: "", type: "drink", name_fr: "", name_en: "", description_fr: "", description_en: "", long_description_fr: "", long_description_en: "", origin: "", cultivar: "", badge: "", base_price: 0, stock: 99, pickup_only: true, active: true, featured: false, sort_order: 1, image_url: "", ideal_for: [], shipping_weight_g: 0 };

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeCategoryName(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildTrackingUrl(carrier: string, trackingNumber: string) {
  const number = trackingNumber.trim();
  if (!number) return "";
  const encoded = encodeURIComponent(number);

  if (carrier === "Colissimo" || carrier === "Chronopost") {
    return `https://www.laposte.fr/outils/suivre-vos-envois?code=${encoded}`;
  }
  if (carrier === "Mondial Relay") return "https://www.mondialrelay.fr/suivi-de-colis/";
  if (carrier === "DHL") return "https://www.dhl.com/fr-fr/home/suivi.html";
  if (carrier === "UPS") return "https://www.ups.com/track?loc=fr_FR";
  return "";
}

function inferProductPreset(category: Category | undefined, zone: "menu" | "shop") {
  const name = normalizeCategoryName(`${category?.name_fr ?? ""} ${category?.name_en ?? ""} ${category?.slug ?? ""}`);
  if (zone === "menu") {
    const type: ProductType = /dessert|douceur|patis|gateau|cake|mochi|cookie|cheesecake/.test(name)
      ? "dessert"
      : /combo|formule|menu-duo|set/.test(name)
        ? "combo"
        : "drink";
    return {
      type, pickup_only: true, stock: 0, shipping_weight_g: 0,
      title: type === "dessert" ? "Dessert" : type === "combo" ? "Combo" : "Boisson",
      fulfillment: "Carte uniquement",
      note: "Article informatif : nom, prix, badge, description et photos. Aucun order en ligne.",
    };
  }
  const type: ProductType = /accessoire|accessory|ustensile|chasen|chawan|bol|fouet|chashaku|cuillere/.test(name) ? "accessory" : "product";
  return {
    type, pickup_only: false, stock: 0, shipping_weight_g: 0,
    title: type === "accessory" ? "Accessoire" : "Matcha / produit",
    fulfillment: "Livraison + retrait",
    note: type === "accessory" ? "Préconfiguré pour un accessoire expédiable." : "Préconfiguré pour un produit Boutique avec variantes possibles.",
  };
}

export function AdminDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessageRow[]>([]);
  const [contactFilter, setContactFilter] = useState<"new" | "all" | "archived">("new");
  const [contactSearch, setContactSearch] = useState("");
 const [orderFilter, setOrderFilter] = useState("active");
const [orderEnvironmentFilter, setOrderEnvironmentFilter] =
  useState<"live" | "test" | "all">("live");
const [orderSearch, setOrderSearch] = useState("");
const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
const [trackingEditOrderId, setTrackingEditOrderId] = useState<string | null>(null);
const [trackingDraft, setTrackingDraft] = useState<TrackingDraft>({ carrier: "", number: "", url: "" });
const [moreActionsOrderId, setMoreActionsOrderId] = useState<string | null>(null);
  const [orderActionMessage, setOrderActionMessage] = useState("");
  const [orderSoundEnabled, setOrderSoundEnabled] = useState(false);
  const orderSoundEnabledRef = useRef(false);
  const seenPendingOrders = useRef<Set<string> | null>(null);
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
  const [statsExpanded, setStatsExpanded] = useState(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setReady(true); return; }
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) return router.replace("/admin/login");
      const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userResult.user.id).maybeSingle();
      if (!admin) { await supabase.auth.signOut(); return router.replace("/admin/login"); }
      await Promise.all([loadProducts(), loadCategories(), loadOrders(), loadMessages(), loadSettings()]);
      setReady(true);
    }
    init();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
  if (!supabase) return;

  const stored = window.localStorage.getItem("ichigo-order-sound");
  const enabled = stored === "1";

  setOrderSoundEnabled(enabled);
  orderSoundEnabledRef.current = enabled;

  const timer = window.setInterval(() => {
    // Ne jamais écraser les champs pendant la saisie du suivi.
    if (!trackingEditOrderId) {
      loadOrders();
    }
  }, 10000);

  return () => window.clearInterval(timer);
}, [supabase, trackingEditOrderId]); // eslint-disable-line react-hooks/exhaustive-deps
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
  function playNewOrderSound() {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const now = context.currentTime;
      [0, 0.16].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(index === 0 ? 880 : 1040, now + delay);
        gain.gain.setValueAtTime(0.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.18, now + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.13);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(now + delay); oscillator.stop(now + delay + 0.14);
      });
      window.setTimeout(() => context.close().catch(() => undefined), 700);
    } catch { /* browser may block audio until a user interaction */ }
  }
  async function loadOrders() {
    if (!supabase) return;
    const { data } = await supabase.from("orders").select("*, order_items(*), invoices(id,document_type,document_number)").is("archived_at", null).order("created_at", { ascending: false }).limit(120);
    const rows = (data ?? []) as OrderRow[];
    const pendingIds = new Set(rows.filter((order) => (order.source_channel === "shop" || order.source_channel === "mixed" || (!order.source_channel && order.order_type === "shipping")) && order.status === "pending" && (order.payment_method !== "online" || order.payment_status === "paid")).map((order) => order.id));
    if (seenPendingOrders.current && orderSoundEnabledRef.current) {
      const hasNew = [...pendingIds].some((id) => !seenPendingOrders.current!.has(id));
      if (hasNew) playNewOrderSound();
    }
    seenPendingOrders.current = pendingIds;
    setOrders(rows);
  }
  function toggleOrderSound() {
    const next = !orderSoundEnabled;
    setOrderSoundEnabled(next);
    orderSoundEnabledRef.current = next;
    window.localStorage.setItem("ichigo-order-sound", next ? "1" : "0");
    if (next) playNewOrderSound();
  }
  async function loadMessages() {
    if (!supabase) return;
    const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) { console.warn("Contact messages unavailable", error.message); return setContactMessages([]); }
    setContactMessages((data ?? []) as ContactMessageRow[]);
  }
  async function updateContactStatus(id: string, status: ContactMessageRow["status"]) {
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
  async function updateOrder(id: string, status: string) {
    if (!supabase) return;
    const order = orders.find((item) => item.id === id);
    if (!order) return;
    setOrderActionMessage("Enregistrement…");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setOrderActionMessage("Session admin expirée.");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status,
          trackingCarrier: order.tracking_carrier ?? "",
          trackingNumber: order.tracking_number ?? "",
          trackingUrl: order.tracking_url ?? "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Modification impossible.");
      setOrderActionMessage(status === "refunded" ? "Remboursement transmis à Stripe ✓" : "Commande enregistrée ✓");
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
    }
  }

  function toggleTrackingEditor(order: OrderRow) {
    if (trackingEditOrderId === order.id) {
      setTrackingEditOrderId(null);
      setTrackingDraft({ carrier: "", number: "", url: "" });
      return;
    }

    const savedCarrier = String(order.tracking_carrier || "").trim();
    const carrier = TRACKING_CARRIERS.includes(savedCarrier as (typeof TRACKING_CARRIERS)[number])
      ? savedCarrier
      : savedCarrier
        ? "Autre"
        : "Colissimo";
    const number = String(order.tracking_number || "");
    const generatedUrl = buildTrackingUrl(carrier, number);

    setTrackingDraft({
      carrier,
      number,
      url: order.tracking_url || generatedUrl,
    });
    setTrackingEditOrderId(order.id);
  }

  async function saveTracking(orderId: string, markShipped = false) {
    if (!supabase) return false;

    const order = orders.find((item) => item.id === orderId);
    if (!order) return false;

    const number = trackingDraft.number.trim();
    if (!number) {
      setOrderActionMessage("Ajoutez un numéro de suivi.");
      return false;
    }

    setOrderActionMessage(markShipped ? "Enregistrement et expédition…" : "Enregistrement du suivi…");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setOrderActionMessage("Session admin expirée.");
      return false;
    }

    const carrier = trackingDraft.carrier.trim() || "Colissimo";
    const url = carrier === "Autre"
      ? trackingDraft.url.trim()
      : buildTrackingUrl(carrier, number);

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...(markShipped ? { status: "completed" } : {}),
          trackingCarrier: carrier,
          trackingNumber: number,
          trackingUrl: url,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (markShipped ? "Impossible de marquer la commande comme expédiée." : "Impossible d’enregistrer le suivi."));

      setOrders((current) =>
        current.map((item) =>
          item.id === orderId
            ? {
                ...item,
                ...(markShipped ? { status: "completed", shipped_at: item.shipped_at || new Date().toISOString() } : {}),
                tracking_carrier: carrier || null,
                tracking_number: number,
                tracking_url: url || null,
              }
            : item
        )
      );

      setOrderActionMessage(markShipped ? "Commande expédiée ✓ · E-mail client déclenché" : "Suivi enregistré ✓");
      setTrackingEditOrderId(null);
      setTrackingDraft({ carrier: "", number: "", url: "" });
      await loadOrders();
      return true;
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
      return false;
    }
  }

  async function markOrderCompleted(order: OrderRow) {
    if (order.order_type !== "shipping") {
      await updateOrder(order.id, "completed");
      return;
    }

    if (!String(order.tracking_number || "").trim()) {
      setOrderActionMessage("Ajoutez d’abord le numéro de suivi avant de marquer le colis comme expédié.");
      if (trackingEditOrderId !== order.id) toggleTrackingEditor(order);
      return;
    }

    await updateOrder(order.id, "completed");
  }
  async function invoiceAction(order: OrderRow, action: "issue" | "email" | "credit_note") {
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setOrderActionMessage("Session admin expirée.");
    setOrderActionMessage(action === "email" ? "Envoi de la facture…" : action === "credit_note" ? "Création de l’avoir…" : "Création de la facture…");
    try {
      const response = await fetch(`/api/admin/invoices/${order.id}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action facture impossible.");
      setOrderActionMessage(action === "email" ? "Facture envoyée ✓" : action === "credit_note" ? "Avoir créé ✓" : "Facture créée ✓");
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Action facture impossible.");
    }
  }

  async function markPickupPaid(id: string) {
    if (!supabase) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return setOrderActionMessage("Session admin expirée.");
    setOrderActionMessage("Enregistrement du paiement…");
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ markPaid: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Modification impossible.");
      setOrderActionMessage("Paiement au retrait enregistré ✓");
      await loadOrders();
    } catch (error) {
      setOrderActionMessage(error instanceof Error ? error.message : "Modification impossible.");
    }
  }

  async function logout() { if (supabase) await supabase.auth.signOut(); router.replace("/admin/login"); }

  if (!ready) return <section className="admin-shell"><div className="loading-card">Chargement de l’administration…</div></section>;
  if (!supabase) return <section className="admin-shell"><div className="setup-warning"><h1>Supabase à connecter</h1><p>Le code est prêt. Ajoutez les clés dans <code>.env.local</code> et exécutez <code>supabase/schema.sql</code>.</p></div></section>;

  const selectedVariants = variants.filter((variant) => variant.product_id === productDraft.id);
  const labels: Record<Tab, string> = { products: "Catalogue", categories: "Catégories", orders: "Commandes", promos: "Promotions", messages: "Messages", invoices: "Facturation", settings: "Réglages", system: "Système" };
  const orderMatchesZone = (order: OrderRow) => order.source_channel === "shop" || order.source_channel === "mixed" || (!order.source_channel && order.order_type === "shipping");
  const zoneOrders = orders.filter((order) => orderMatchesZone(order));
  const orderStats = {
    pending: zoneOrders.filter((order) => order.status === "pending").length,
    preparing: zoneOrders.filter((order) => order.status === "preparing").length,
    ready: zoneOrders.filter((order) => order.status === "ready").length,
    active: zoneOrders.filter((order) => ["pending", "preparing", "ready"].includes(order.status)).length,
  };
  const search = orderSearch.trim().toLowerCase();
  const filteredOrders = orders.filter((order) => {
  const matchesFilter =
    orderFilter === "all"
      ? true
      : orderFilter === "active"
        ? ["pending", "preparing", "ready"].includes(order.status)
        : order.status === orderFilter;

  const matchesEnvironment =
    orderEnvironmentFilter === "all"
      ? true
      : order.environment === orderEnvironmentFilter;

  const haystack =
    `${order.order_number} ${order.customer_first_name} ${order.customer_last_name} ${order.customer_phone} ${order.customer_email} ${order.shipping_city ?? ""}`.toLowerCase();

  return (
    orderMatchesZone(order) &&
    matchesFilter &&
    matchesEnvironment &&
    (!search || haystack.includes(search))
  );
});
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
          {(["orders", "messages"] as Tab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{labels[name]}{name === "orders" && orders.filter((o) => o.status === "pending").length ? <span>{orders.filter((o) => o.status === "pending").length}</span> : name === "messages" && newContactCount ? <span>{newContactCount}</span> : null}</button>)}
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
    {tab === "orders" && <div className="orders-admin orders-v214 orders-v227">
      <div className="section-inline orders-heading"><div><h2>Commandes</h2><p className="muted">Commandes de la Boutique en ligne : paiement, préparation, retrait ou expédition.</p></div><div className="orders-heading-actions"><button type="button" className={orderSoundEnabled ? "sound-toggle active" : "sound-toggle"} onClick={toggleOrderSound}>{orderSoundEnabled ? "🔔 Son activé" : "🔕 Activer le son"}</button><button onClick={loadOrders}>Actualiser</button></div></div>
      {orderActionMessage && <p className={orderActionMessage.includes("✓") ? "save-message success" : "save-message"}>{orderActionMessage}</p>}
      <div className="admin-stats-shell-v247">
  <button
    type="button"
    className="admin-stats-toggle-v247"
    onClick={() => setStatsExpanded((current) => !current)}
  >
    <span>
      <strong>Pilotage Boutique</strong>
      <small>
        {statsExpanded
          ? "Masquer les statistiques"
          : "Afficher les statistiques détaillées"}
      </small>
    </span>

    <span className="admin-stats-toggle-icon-v247">
      {statsExpanded ? "−" : "+"}
    </span>
  </button>

  {statsExpanded && (
    <OrderStatistics
      supabase={supabase}
      refreshKey={orders
        .map(
          (order) =>
            `${order.id}:${order.status}:${order.payment_status}:${order.total}`
        )
        .join("|")}
    />
  )}
</div>
      <div className="production-order-note-v227"><strong>Flux production</strong><span>Paiement confirmé → préparation → suivi colis → expédition. Une commande Stripe payée ne peut plus être simplement annulée : utilisez le remboursement Stripe.</span></div>
      <div className="order-kpis"><button className={orderFilter === "active" ? "active" : ""} onClick={() => setOrderFilter("active")}><span>À traiter</span><strong>{orderStats.active}</strong></button><button className={orderFilter === "pending" ? "active" : ""} onClick={() => setOrderFilter("pending")}><span>Nouvelles</span><strong>{orderStats.pending}</strong></button><button className={orderFilter === "preparing" ? "active" : ""} onClick={() => setOrderFilter("preparing")}><span>En préparation</span><strong>{orderStats.preparing}</strong></button><button className={orderFilter === "ready" ? "active" : ""} onClick={() => setOrderFilter("ready")}><span>Prêtes</span><strong>{orderStats.ready}</strong></button></div>
      <div className="order-environment-switch">
  <button
    type="button"
    className={orderEnvironmentFilter === "live" ? "active live" : ""}
    onClick={() => setOrderEnvironmentFilter("live")}
  >
    LIVE
    <strong>
      {zoneOrders.filter((order) => order.environment === "live").length}
    </strong>
  </button>

  <button
    type="button"
    className={orderEnvironmentFilter === "test" ? "active test" : ""}
    onClick={() => setOrderEnvironmentFilter("test")}
  >
    TEST
    <strong>
      {zoneOrders.filter((order) => order.environment === "test").length}
    </strong>
  </button>

  <button
    type="button"
    className={orderEnvironmentFilter === "all" ? "active" : ""}
    onClick={() => setOrderEnvironmentFilter("all")}
  >
    Toutes
  </button>
</div>
      <div className="order-toolbar"><div className="order-filters">{[["active","Actives"],["pending","Nouvelles"],["preparing","Préparation"],["ready","Prêtes"],["completed","Terminées / expédiées"],["cancelled","Annulées"],["refunded","Remboursées"],["all","Toutes"]].map(([value,label]) => <button key={value} className={orderFilter === value ? "active" : ""} onClick={() => setOrderFilter(value)}>{label}</button>)}</div><input className="order-search" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="N° commande, nom, téléphone, ville…" /></div>
      {filteredOrders.length ? <div className="order-grid">{filteredOrders.map((order) => {
        const paymentBlocked = order.payment_method === "online" && order.payment_status !== "paid";
        const paymentLabel = order.payment_status === "paid" ? "Payée" : order.payment_status === "refunded" ? "Remboursée" : order.payment_status === "refund_pending" ? "Remboursement en cours" : order.payment_status === "refund_failed" ? "Remboursement à vérifier" : order.payment_status === "pending" ? "En attente Stripe" : order.payment_status === "failed" ? "Échec paiement" : order.payment_status === "expired" ? "Paiement expiré" : order.payment_method === "pickup" ? "Au retrait" : "À payer";
        const canRefund = order.payment_method === "online" && Number(order.total) > 0 && ["paid", "refund_failed"].includes(order.payment_status) && order.status !== "refunded";
        return <article className={`order-card status-${order.status} channel-shop ${order.status === "pending" ? "is-new" : ""}`} key={order.id}><div className="order-compact-summary-v248">
  <div>
    <strong>
      {order.customer_first_name} {order.customer_last_name}
    </strong>

    <span>
      {order.order_type === "shipping"
        ? `${order.shipping_city || "Livraison"} · ${
            order.order_items?.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0
            ) || 0
          } article(s) · ${order.package_weight_g || 0} g`
        : order.pickup_time
          ? `Retrait · ${new Date(order.pickup_time).toLocaleString("fr-FR", {
              dateStyle: "short",
              timeStyle: "short",
            })}`
          : "Retrait boutique"}
    </span>
  </div>

  <button
    type="button"
    className="button ghost small order-details-toggle-v248"
    onClick={() =>
      setExpandedOrderId((current) =>
        current === order.id ? null : order.id
      )
    }
  >
    {expandedOrderId === order.id ? "Fermer ↑" : "Détails ↓"}
  </button>
</div>
          <div className="order-card-top"><div><span className={`order-status-dot ${order.status}`}></span><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><span className="channel-pill shop">Boutique</span>{order.environment && <span className={`order-env-pill-v246 ${order.environment}`}>{order.environment === "live" ? "LIVE" : order.environment === "test" ? "TEST" : "LEGACY"}</span>}</div><div><span className={`payment-pill ${order.payment_status}`}>{paymentLabel}</span><strong>{Number(order.total).toFixed(2)} €</strong></div></div>
          {expandedOrderId === order.id && (
  <div className="order-body"><div className="order-main"><div className="order-customer"><strong>{order.customer_first_name} {order.customer_last_name}</strong><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>{order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}<span className="pickup-pill">{order.order_type === "shipping" ? `Livraison · ${order.package_weight_g || 0} g` : order.pickup_time ? `Retrait ${new Date(order.pickup_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Retrait boutique"}</span></div>
          {order.order_type === "shipping" && (
  <>
    <div className="order-shipping-box">
      <strong>{order.shipping_method_name || "Livraison"}</strong>

      <span>
        {[
          order.shipping_address1,
          order.shipping_address2,
          `${order.shipping_postal_code || ""} ${order.shipping_city || ""}`.trim(),
          order.shipping_country === "FR"
            ? "France"
            : order.shipping_country,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>

      <small>
        Frais : {Number(order.shipping_fee || 0).toFixed(2)} €
        {" · "}
        Poids colis : {Number(order.package_weight_g || 0)} g
      </small>
    </div>

    <div className="tracking-compact-v249">
      <div className="tracking-compact-head-v249">
        <div>
          <span className="tracking-label-v249">SUIVI</span>

          {order.tracking_number ? (
            <>
              <strong>
                {order.tracking_carrier || "Transporteur"} ·{" "}
                {order.tracking_number}
              </strong>

              {order.shipped_at && (
                <small>
                  Expédiée le{" "}
                  {new Date(order.shipped_at).toLocaleDateString("fr-FR")}
                </small>
              )}
            </>
          ) : (
            <>
              <strong>Aucun suivi enregistré</strong>
              <small>
                Ajoutez le numéro lorsque le colis est prêt à partir.
              </small>
            </>
          )}
        </div>

        <div className="tracking-compact-actions-v249">
          {order.tracking_url && order.tracking_number && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noreferrer"
              className="button ghost small"
            >
              Ouvrir ↗
            </a>
          )}

          <button
            type="button"
            className="button ghost small"
            onClick={() => toggleTrackingEditor(order)}
          >
            {trackingEditOrderId === order.id
              ? "Fermer"
              : order.tracking_number
                ? "Modifier"
                : "+ Ajouter"}
          </button>
        </div>
      </div>

      {trackingEditOrderId === order.id && (
        <div className="tracking-admin-grid-v227 tracking-editor-v249">
          <label>
            Transporteur
            <select
              value={trackingDraft.carrier}
              onChange={(e) => {
                const carrier = e.target.value;
                setTrackingDraft((current) => ({
                  ...current,
                  carrier,
                  url: carrier === "Autre" ? current.url : buildTrackingUrl(carrier, current.number),
                }));
              }}
            >
              {TRACKING_CARRIERS.map((carrier) => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>
          </label>

          <label>
            N° de suivi
            <input
              value={trackingDraft.number}
              placeholder="XXXXXXXXXXXXX"
              autoComplete="off"
              onChange={(e) => {
                const number = e.target.value;
                setTrackingDraft((current) => ({
                  ...current,
                  number,
                  url: current.carrier === "Autre" ? current.url : buildTrackingUrl(current.carrier, number),
                }));
              }}
            />
          </label>

          {trackingDraft.carrier === "Autre" ? (
            <label className="tracking-url-field-v227">
              Lien de suivi
              <input
                value={trackingDraft.url}
                placeholder="https://…"
                onChange={(e) =>
                  setTrackingDraft((current) => ({
                    ...current,
                    url: e.target.value,
                  }))
                }
              />
            </label>
          ) : (
            <label className="tracking-url-field-v227">
              Lien généré automatiquement
              <input
                value={trackingDraft.url}
                placeholder="Saisissez le numéro de suivi"
                readOnly
              />
            </label>
          )}

          {trackingDraft.url && (
            <a
              className="button ghost small"
              href={trackingDraft.url}
              target="_blank"
              rel="noreferrer"
            >
              Tester le lien ↗
            </a>
          )}

          <div className="tracking-save-actions-v259">
            <button
              type="button"
              className="button ghost small"
              disabled={order.status === "refunded" || !trackingDraft.number.trim()}
              onClick={() => saveTracking(order.id)}
            >
              Enregistrer le suivi
            </button>

            {order.status === "ready" && (
              <button
                type="button"
                className="button primary small"
                disabled={!trackingDraft.number.trim()}
                onClick={() => saveTracking(order.id, true)}
              >
                Enregistrer et expédier
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  </>
)}
          <div className="order-lines">{order.order_items?.map((item) => <p key={item.id}><span><strong>{item.quantity} × {item.product_name}</strong>{item.choices?.length ? <small>{item.choices.map((choice) => choice.label).filter(Boolean).join(" · ")}</small> : null}</span>{typeof item.line_total === "number" && <strong>{Number(item.line_total).toFixed(2)} €</strong>}</p>)}</div>{Number(order.discount_amount || 0) > 0 && <div className="order-promo-v234"><span><strong>Code promo · {order.promo_code}</strong><small>Réduction appliquée à la commande</small></span><strong>− {Number(order.discount_amount || 0).toFixed(2)} €</strong></div>}{order.notes && <p className="order-note"><strong>Note :</strong> {order.notes}</p>}</div>
          <aside className="order-actions"><label>Statut<select value={order.status} disabled={order.status === "refunded" || order.payment_status === "refund_pending"} onChange={(e) => updateOrder(order.id, e.target.value)}><option value="pending">Nouvelle</option><option value="preparing">En préparation</option><option value="ready">{order.order_type === "shipping" ? "Prête à expédier" : "Prête"}</option><option value="completed">{order.order_type === "shipping" ? "Expédiée" : "Terminée"}</option><option value="cancelled">Annulée</option>{order.status === "refunded" && <option value="refunded">Remboursée</option>}</select></label>
            {paymentBlocked ? <div className="payment-blocked-admin"><strong>{order.payment_status === "refund_pending" ? "Remboursement en cours" : order.payment_status === "refund_failed" ? "Remboursement à vérifier" : "Paiement requis"}</strong><small>{order.payment_status === "refund_pending" ? "Stripe traite le remboursement." : order.payment_status === "refund_failed" ? "Vérifiez Stripe avant toute nouvelle action." : "La préparation est bloquée jusqu’à confirmation Stripe."}</small>{!["refund_pending", "refund_failed", "refunded"].includes(order.payment_status) && <button type="button" className="button ghost small" onClick={() => updateOrder(order.id, "cancelled")}>Annuler la commande</button>}</div> : <>{order.status === "pending" && <button className="button primary order-next-action" onClick={() => updateOrder(order.id, "preparing")}>Préparer</button>}{order.status === "preparing" && <button className="button primary order-next-action" onClick={() => updateOrder(order.id, "ready")}>{order.order_type === "shipping" ? "Colis prêt" : "Prête"}</button>}{order.status === "ready" && <button className="button primary order-next-action" onClick={() => markOrderCompleted(order)}>{order.order_type === "shipping" ? (order.tracking_number ? "Marquer expédiée" : "Ajouter suivi & expédier") : "Remise"}</button>}</>}
            
            {order.payment_status === "paid" && !order.invoices?.some((doc) => doc.document_type === "invoice") && <button type="button" className="button ghost small invoice-admin-action-v245" onClick={() => invoiceAction(order, "issue")}>Créer la facture</button>}
            {order.public_token && order.invoices?.some((doc) => doc.document_type === "invoice") && <a className="button ghost small invoice-admin-action-v245" href={`/api/invoices/${order.id}?token=${encodeURIComponent(order.public_token)}`}>Facture PDF ↓</a>}
            <div className="order-more-menu-v249">
              <button
                type="button"
                className="button ghost small order-more-button-v249"
                onClick={() =>
                  setMoreActionsOrderId((current) =>
                    current === order.id ? null : order.id
                  )
                }
                aria-expanded={moreActionsOrderId === order.id}
                aria-label="Plus d’actions"
              >
                •••
              </button>

              {moreActionsOrderId === order.id && (
                <div className="order-more-popover-v249">
                  {order.invoices?.some(
                    (doc) => doc.document_type === "invoice"
                  ) && (
                    <button
                      type="button"
                      onClick={async () => {
                        setMoreActionsOrderId(null);
                        await invoiceAction(order, "email");
                      }}
                    >
                      Renvoyer la facture
                    </button>
                  )}

                  {order.public_token && (
                    <a
                      href={`/commande/${order.public_token}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Vue client ↗
                    </a>
                  )}

                  {order.payment_status === "refunded" &&
                    !order.invoices?.some(
                      (doc) => doc.document_type === "credit_note"
                    ) && (
                      <button
                        type="button"
                        onClick={async () => {
                          setMoreActionsOrderId(null);
                          await invoiceAction(order, "credit_note");
                        }}
                      >
                        Créer l’avoir
                      </button>
                    )}

                  {order.public_token &&
                    order.invoices?.some(
                      (doc) => doc.document_type === "credit_note"
                    ) && (
                      <a
                        href={`/api/invoices/${order.id}?token=${encodeURIComponent(
                          order.public_token
                        )}&type=credit_note`}
                      >
                        Avoir PDF ↓
                      </a>
                    )}

                  {canRefund && (
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        setMoreActionsOrderId(null);
                        if (
                          window.confirm(
                            `Rembourser ${order.order_number} via Stripe ?`
                          )
                        ) {
                          void updateOrder(order.id, "refunded");
                        }
                      }}
                    >
                      Rembourser via Stripe
                    </button>
                  )}
                </div>
              )}
            </div>
          </aside>
</div>
)}
</article>;
      })}</div> : <div className="empty-state">Aucune commande Boutique dans cette vue.</div>}
    </div>}
    {tab === "promos" && <PromotionsAdmin supabase={supabase} />}
    {tab === "invoices" && <InvoiceSettingsAdmin supabase={supabase} />}
    {tab === "system" && <ProductionAdmin supabase={supabase} onOrdersChanged={loadOrders} />}
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
