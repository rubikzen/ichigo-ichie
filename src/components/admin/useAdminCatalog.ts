"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Category, Variant } from "@/lib/types";
import {
  blankProduct,
  inferProductPreset,
  slugify,
  type AdminProduct,
} from "./catalog-model";

export function useAdminCatalog(
  supabase: ReturnType<typeof createBrowserSupabase>,
  categories: Category[],
) {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [productDraft, setProductDraft] = useState<AdminProduct>(blankProduct);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [catalogZone, setCatalogZone] = useState<"menu" | "shop">("menu");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [quickSavingId, setQuickSavingId] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void loadProducts();
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

  function chooseProduct(
    product?: AdminProduct,
    zone: "menu" | "shop" = catalogZone,
    preferredCategoryId?: string,
  ) {
    setMessage("");
    setAdvancedOpen(true);

    if (!product) {
      const preferredCategory = preferredCategoryId
        ? categories.find(
            (category) =>
              category.id === preferredCategoryId && category.kind === zone,
          )
        : undefined;
      const firstCategory =
        preferredCategory ??
        categories.find((category) => category.kind === zone && category.active) ??
        categories.find((category) => category.kind === zone);
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
        sort_order: firstCategory
          ? products.filter((item) => item.category_id === firstCategory.id).length + 1
          : 1,
      });
      return;
    }

    const kind = categories.find(
      (category) => category.id === product.category_id,
    )?.kind;
    if (kind === "menu" || kind === "shop") setCatalogZone(kind);
    setSelectedId(product.id);
    setProductDraft({ ...product, ideal_for: product.ideal_for ?? [] });
  }

  function changeDraftCategory(categoryId: string) {
    const category = categories.find((item) => item.id === categoryId);

    if (!category || productDraft.id) {
      setProductDraft((current) => ({
        ...current,
        category_id: categoryId,
      }));
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
      sort_order:
        products.filter((item) => item.category_id === categoryId).length + 1,
    }));
  }

  async function saveProduct(event: FormEvent) {
    if (!supabase) return;
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      slug: productDraft.slug || slugify(productDraft.name_fr),
      category_id: productDraft.category_id,
      type: productDraft.type,
      name_fr: productDraft.name_fr,
      name_en: productDraft.name_en || productDraft.name_fr,
      description_fr: productDraft.description_fr,
      description_en: productDraft.description_en || productDraft.description_fr,
      long_description_fr:
        productDraft.long_description_fr?.trim() ||
        productDraft.description_fr ||
        null,
      long_description_en:
        productDraft.long_description_en?.trim() ||
        productDraft.description_en ||
        productDraft.description_fr ||
        null,
      origin: productDraft.origin || null,
      cultivar: productDraft.cultivar || null,
      badge: productDraft.badge || null,
      base_price: Number(productDraft.base_price),
      stock: Number(productDraft.stock),
      pickup_only: productDraft.pickup_only,
      active: productDraft.active,
      featured: productDraft.featured,
      sort_order: Number(productDraft.sort_order),
      image_url: productDraft.image_url || null,
      ideal_for: productDraft.ideal_for.filter(Boolean),
      shipping_weight_g: Number(productDraft.shipping_weight_g || 0),
    };

    if (productDraft.id) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", productDraft.id);

      setSaving(false);
      if (error) return setMessage(error.message);

      setMessage("Enregistré ✓");
      await loadProducts();
      setProductDraft((current) => ({ ...current, ...payload }));
      return;
    }

    const { data, error } = await supabase
      .from("products")
      .insert(payload)
      .select("*")
      .single();

    setSaving(false);
    if (error || !data) {
      return setMessage(error?.message ?? "Création impossible.");
    }

    setMessage("Enregistré ✓");
    await loadProducts();
    chooseProduct(data as AdminProduct);
  }

  async function deleteProduct(id: string) {
    if (!supabase) return;
    if (!window.confirm("Supprimer ce produit ?")) return;

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return setMessage(error.message);

    setSelectedId("");
    setProductDraft(blankProduct);
    await loadProducts();
  }

  async function quickPatchProduct(
    id: string,
    patch: Partial<AdminProduct>,
  ) {
    if (!supabase) return;
    setQuickSavingId(id);
    setMessage("");

    const cleanPatch: Record<string, unknown> = { ...patch };
    if ("base_price" in patch) cleanPatch.base_price = Number(patch.base_price);
    if ("stock" in patch) cleanPatch.stock = Number(patch.stock);
    if ("shipping_weight_g" in patch) {
      cleanPatch.shipping_weight_g = Number(patch.shipping_weight_g || 0);
    }
    if ("sort_order" in patch) cleanPatch.sort_order = Number(patch.sort_order);

    const { error } = await supabase
      .from("products")
      .update(cleanPatch)
      .eq("id", id);

    setQuickSavingId("");

    if (error) {
      setMessage(error.message);
      await loadProducts();
      return;
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === id ? { ...product, ...patch } : product,
      ),
    );

    if (productDraft.id === id) {
      setProductDraft((current) => ({ ...current, ...patch }));
    }
  }

  async function duplicateProduct(product: AdminProduct) {
    if (!supabase) return;
    setQuickSavingId(product.id);

    const payload = {
      slug: `${product.slug}-copie-${Date.now().toString().slice(-6)}`,
      category_id: product.category_id,
      type: product.type,
      name_fr: `${product.name_fr} — copie`,
      name_en: `${product.name_en || product.name_fr} — copy`,
      description_fr: product.description_fr,
      description_en: product.description_en,
      long_description_fr: product.long_description_fr,
      long_description_en: product.long_description_en,
      origin: product.origin,
      cultivar: product.cultivar,
      badge: product.badge,
      base_price: Number(product.base_price),
      stock: Number(product.stock),
      pickup_only: product.pickup_only,
      active: false,
      featured: false,
      sort_order:
        products.filter((item) => item.category_id === product.category_id)
          .length + 1,
      image_url: product.image_url,
      ideal_for: product.ideal_for ?? [],
      shipping_weight_g: Number(product.shipping_weight_g || 0),
    };

    const { data: created, error } = await supabase
      .from("products")
      .insert(payload)
      .select("*")
      .single();

    if (error || !created) {
      setQuickSavingId("");
      return setMessage(error?.message ?? "Duplication impossible.");
    }

    const sourceVariants = variants.filter(
      (variant) => variant.product_id === product.id,
    );

    if (sourceVariants.length) {
      await supabase.from("product_variants").insert(
        sourceVariants.map((variant, variantIndex) => ({
          product_id: created.id,
          name: variant.name,
          packaging: variant.packaging,
          weight: variant.weight,
          price: Number(variant.price),
          stock: Number(variant.stock),
          active: variant.active,
          sort_order: variantIndex + 1,
          image_url: variant.image_url ?? null,
          shipping_weight_g: Number(variant.shipping_weight_g || 0),
        })),
      );
    }

    setQuickSavingId("");
    setMessage("Produit dupliqué ✓ — il est masqué par défaut.");
    await loadProducts();
  }

  async function moveProduct(product: AdminProduct, direction: -1 | 1) {
    if (!supabase) return;
    const ordered = products
      .filter((item) => item.category_id === product.category_id)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.name_fr.localeCompare(b.name_fr),
      );

    const index = ordered.findIndex((item) => item.id === product.id);
    const neighbor = ordered[index + direction];
    if (!neighbor) return;

    setQuickSavingId(product.id);

    const currentOrder = product.sort_order;
    const neighborOrder = neighbor.sort_order;
    const fallbackBase = index * 10 + 10;

    await Promise.all([
      supabase
        .from("products")
        .update({
          sort_order:
            neighborOrder === currentOrder
              ? fallbackBase + direction
              : neighborOrder,
        })
        .eq("id", product.id),
      supabase
        .from("products")
        .update({
          sort_order:
            neighborOrder === currentOrder ? fallbackBase : currentOrder,
        })
        .eq("id", neighbor.id),
    ]);

    setQuickSavingId("");
    await loadProducts();
  }

  async function addVariant() {
    if (!supabase) return;
    if (!productDraft.id) {
      return setMessage("Enregistrez d’abord le produit.");
    }

    const productVariants = variants.filter(
      (variant) => variant.product_id === productDraft.id,
    );

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
    const signature = `${variant.packaging ?? "other"}|${String(
      variant.weight ?? "",
    )
      .trim()
      .toLowerCase()}|${String(variant.name ?? "").trim().toLowerCase()}`;

    const duplicate = variants.some(
      (item) =>
        item.product_id === variant.product_id &&
        item.id !== variant.id &&
        `${item.packaging ?? "other"}|${String(item.weight ?? "")
          .trim()
          .toLowerCase()}|${String(item.name ?? "")
          .trim()
          .toLowerCase()}` === signature,
    );

    if (duplicate) {
      return setMessage(
        "Ce modèle existe déjà : changez le conditionnement, le poids ou le nom.",
      );
    }

    if (
      !String(variant.name ?? "").trim() &&
      !String(variant.weight ?? "").trim()
    ) {
      return setMessage("Ajoutez au moins un nom de modèle ou un poids.");
    }

    const { error } = await supabase
      .from("product_variants")
      .update({
        name: String(variant.name || variant.weight || "Format").trim(),
        packaging: variant.packaging,
        weight: variant.weight || null,
        price: Number(variant.price),
        stock: Number(variant.stock),
        active: variant.active,
        shipping_weight_g: Number(variant.shipping_weight_g || 0),
      })
      .eq("id", variant.id);

    setMessage(error ? error.message : "Format enregistré ✓");
    if (!error) await loadProducts();
  }

  async function deleteVariant(id: string) {
    if (!supabase) return;
    if (!window.confirm("Supprimer ce format ?")) return;
    await supabase.from("product_variants").delete().eq("id", id);
    await loadProducts();
  }

  return {
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
  };
}
