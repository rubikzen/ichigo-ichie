"use client";

import { FormEvent, useEffect, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Category, Variant } from "@/lib/types";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function VariantEditor({ variant, onChange, onSave, onDelete }: { variant: Variant; onChange: (variant: Variant) => void; onSave: (variant: Variant) => void; onDelete: (id: string) => void }) {
  const packageName = variant.packaging === "can" ? "Boîte" : variant.packaging === "bag" ? "Sachet" : "Autre";
  return <article className={`variant-editor-card ${variant.active ? "" : "is-inactive"}`}>
    <div className="variant-editor-preview shared-gallery-variant">
      <div className="variant-package-symbol">{variant.packaging === "can" ? "▣" : variant.packaging === "bag" ? "▱" : "◇"}</div>
      <div><strong>{packageName} · {variant.weight || variant.name || "Nouveau format"}</strong><small>{variant.active ? "Visible pour le client" : "Masqué pour le client"} · Photos communes au produit</small></div>
    </div>
    <div className="variant-editor-grid">
      <label>Conditionnement<select value={variant.packaging ?? "other"} onChange={(e) => onChange({ ...variant, packaging: e.target.value as Variant["packaging"] })}><option value="can">Boîte</option><option value="bag">Sachet</option><option value="other">Autre</option></select></label>
      <label>Nom du modèle<input value={variant.name} onChange={(e) => onChange({ ...variant, name: e.target.value })} placeholder="Ex. Premium, Recharge…" /><small>Facultatif si le poids suffit.</small></label>
      <label>Poids / format<input value={variant.weight ?? ""} onChange={(e) => onChange({ ...variant, weight: e.target.value })} placeholder="30 g, 50 g, 100 g…" /></label>
      <label>Prix (€)<input type="number" min="0" step="0.01" value={variant.price} onChange={(e) => onChange({ ...variant, price: Number(e.target.value) })} /></label>
      <label>Stock<input type="number" min="0" value={variant.stock} onChange={(e) => onChange({ ...variant, stock: Number(e.target.value) })} /></label>
      <label>Poids expédition (g)<input type="number" min="0" value={variant.shipping_weight_g ?? 0} onChange={(e) => onChange({ ...variant, shipping_weight_g: Number(e.target.value) })} /><small>Poids réel emballé de ce modèle.</small></label>
    </div>
    <div className="variant-editor-actions">
      <label className="check-label"><input type="checkbox" checked={variant.active} onChange={(e) => onChange({ ...variant, active: e.target.checked })} /> Actif / visible</label>
      <span className="variant-stock-note">{variant.stock <= 0 ? "Stock épuisé : choix désactivé côté client" : `${variant.stock} en stock`}</span>
      <button type="button" onClick={() => onSave(variant)}>Enregistrer ce modèle</button>
      <button type="button" className="text-danger" onClick={() => onDelete(variant.id)}>Supprimer</button>
    </div>
  </article>;
}

export function CategoryAdmin({ categories, supabase, reload }: { categories: Category[]; supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>; reload: () => Promise<void> }) {
  const [zone, setZone] = useState<"menu" | "shop">("menu");
  const [rows, setRows] = useState<Category[]>(categories);
  const [draft, setDraft] = useState({ name_fr: "", name_en: "", slug: "", kind: "menu" as "menu" | "shop", sort_order: 1 });
  const [note, setNote] = useState("");
  useEffect(() => setRows(categories), [categories]);
  async function add(event: FormEvent) { event.preventDefault(); const { error } = await supabase.from("categories").insert({ ...draft, kind: zone, name_en: draft.name_en || draft.name_fr, slug: draft.slug || slugify(draft.name_fr), active: true, sort_order: categories.filter((category) => category.kind === zone).length + 1 }); if (error) return setNote(error.message); setDraft({ name_fr: "", name_en: "", slug: "", kind: zone, sort_order: 1 }); setNote("Catégorie ajoutée ✓"); await reload(); }
  async function save(category: Category) { const { error } = await supabase.from("categories").update({ name_fr: category.name_fr, name_en: category.name_en || category.name_fr, sort_order: Number(category.sort_order), active: category.active }).eq("id", category.id); setNote(error ? error.message : "Catégorie enregistrée ✓"); if (!error) await reload(); }
  async function toggle(category: Category) { await supabase.from("categories").update({ active: !category.active }).eq("id", category.id); await reload(); }
  const visibleRows = rows.filter((category) => category.kind === zone).sort((a, b) => a.sort_order - b.sort_order);
  return <div className="category-admin quick-category-admin"><div className="category-main"><div className="section-inline"><div><h2>Catégories</h2><p className="muted">Renommez, réordonnez ou masquez les catégories sans ouvrir une autre fiche.</p></div><div className="catalog-zone-switch compact"><button type="button" className={zone === "menu" ? "active" : ""} onClick={() => setZone("menu")}>Menu</button><button type="button" className={zone === "shop" ? "active" : ""} onClick={() => setZone("shop")}>Boutique</button></div></div>{note && <p className={note.includes("✓") ? "save-message success" : "save-message"}>{note}</p>}<div className="quick-category-list">{visibleRows.map((category) => <div className={`quick-category-row ${category.active ? "" : "is-hidden"}`} key={category.id}><input value={category.name_fr} onChange={(e) => setRows((current) => current.map((item) => item.id === category.id ? { ...item, name_fr: e.target.value } : item))} /><input value={category.name_en} onChange={(e) => setRows((current) => current.map((item) => item.id === category.id ? { ...item, name_en: e.target.value } : item))} placeholder="EN (optionnel)" /><label>Ordre<input type="number" min="0" value={category.sort_order} onChange={(e) => setRows((current) => current.map((item) => item.id === category.id ? { ...item, sort_order: Number(e.target.value) } : item))} /></label><button type="button" className={`quick-visibility ${category.active ? "active" : ""}`} onClick={() => toggle(category)}>{category.active ? "Visible" : "Masquée"}</button><button type="button" onClick={() => save(category)}>Sauver</button></div>)}</div></div><form onSubmit={add} className="admin-side-form"><h3>Nouvelle catégorie {zone === "menu" ? "Menu" : "Boutique"}</h3><label>Nom FR<input value={draft.name_fr} onChange={(e) => setDraft({ ...draft, name_fr: e.target.value })} required /></label><label>Nom EN <small>(facultatif)</small><input value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} /></label><button className="button primary">+ Ajouter</button></form></div>;
}

