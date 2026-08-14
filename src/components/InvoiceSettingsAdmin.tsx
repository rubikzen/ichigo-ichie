"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProductVat = { id: string; name_fr: string; active: boolean; category_id: string; vat_rate: number | null };

const keys = [
  "invoice_enabled", "invoice_auto_email", "invoice_prefix", "credit_note_prefix", "invoice_shipping_vat_rate",
  "invoice_legal_name", "invoice_trade_name", "invoice_address1", "invoice_address2", "invoice_postal_code", "invoice_city",
  "invoice_country", "invoice_siren", "invoice_siret", "invoice_vat_number", "invoice_rcs", "invoice_capital",
  "invoice_email", "invoice_phone", "invoice_footer",
];

const defaults: Record<string, string> = {
  invoice_enabled: "false",
  invoice_auto_email: "true",
  invoice_prefix: "FAC",
  credit_note_prefix: "AV",
  invoice_shipping_vat_rate: "20",
  invoice_legal_name: "",
  invoice_trade_name: "ICHIGO ICHIE",
  invoice_address1: "",
  invoice_address2: "",
  invoice_postal_code: "",
  invoice_city: "",
  invoice_country: "France",
  invoice_siren: "",
  invoice_siret: "",
  invoice_vat_number: "",
  invoice_rcs: "",
  invoice_capital: "",
  invoice_email: "",
  invoice_phone: "",
  invoice_footer: "Merci pour votre confiance.",
};

function settingText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return value == null ? "" : String(value);
}

export function InvoiceSettingsAdmin({ supabase }: { supabase: SupabaseClient }) {
  const [settings, setSettings] = useState<Record<string, string>>({ ...defaults });
  const [products, setProducts] = useState<ProductVat[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [{ data: settingRows }, { data: categoryRows }] = await Promise.all([
      supabase.from("site_settings").select("key,value").in("key", keys),
      supabase.from("categories").select("id").eq("kind", "shop"),
    ]);
    const next = { ...defaults };
    for (const row of settingRows ?? []) next[row.key] = settingText(row.value);
    setSettings(next);
    const categoryIds = (categoryRows ?? []).map((row: any) => row.id);
    if (!categoryIds.length) return setProducts([]);
    const { data: productRows } = await supabase.from("products").select("id,name_fr,active,category_id,vat_rate").in("category_id", categoryIds).order("name_fr");
    setProducts((productRows ?? []).map((row: any) => ({ ...row, vat_rate: row.vat_rate == null ? null : Number(row.vat_rate) })) as ProductVat[]);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const missingLegal = useMemo(() => [
    ["invoice_legal_name", "Raison sociale"],
    ["invoice_address1", "Adresse"],
    ["invoice_postal_code", "Code postal"],
    ["invoice_city", "Ville"],
    ["invoice_siren", "SIREN"],
  ].filter(([key]) => !settings[key]?.trim()).map(([, label]) => label), [settings]);
  const missingVat = products.filter((product) => product.vat_rate == null);
  const ready = missingLegal.length === 0 && missingVat.length === 0;
  const filtered = products.filter((product) => !search.trim() || product.name_fr.toLowerCase().includes(search.trim().toLowerCase()));

  function set(key: string, value: string) { setSettings((current) => ({ ...current, [key]: value })); }

  async function saveSettings() {
    setSaving(true); setMessage("");
    const rows = keys.map((key) => ({ key, value: settings[key] ?? "" }));
    const { error } = await supabase.from("site_settings").upsert(rows, { onConflict: "key" });
    setSaving(false);
    setMessage(error ? error.message : "Paramètres de facturation enregistrés ✓");
  }

  async function saveVat(product: ProductVat) {
    const { error } = await supabase.from("products").update({ vat_rate: product.vat_rate }).eq("id", product.id);
    setMessage(error ? error.message : `TVA ${product.name_fr} enregistrée ✓`);
    if (!error) await load();
  }

  async function applyRateToMissing(rate: number) {
    if (!window.confirm(`Appliquer ${rate} % aux ${missingVat.length} produit(s) sans taux ? Vérifiez ce taux avec votre comptable avant utilisation.`)) return;
    const ids = missingVat.map((product) => product.id);
    if (!ids.length) return;
    const { error } = await supabase.from("products").update({ vat_rate: rate }).in("id", ids);
    setMessage(error ? error.message : `TVA ${rate} % appliquée aux produits sans taux ✓`);
    if (!error) await load();
  }

  async function toggleEnabled() {
    if (settings.invoice_enabled !== "true" && !ready) {
      return setMessage(`Impossible d’activer : ${missingLegal.length ? `informations légales manquantes (${missingLegal.join(", ")})` : ""}${missingLegal.length && missingVat.length ? " · " : ""}${missingVat.length ? `${missingVat.length} produit(s) sans TVA` : ""}.`);
    }
    const next = settings.invoice_enabled === "true" ? "false" : "true";
    set("invoice_enabled", next);
    const { error } = await supabase.from("site_settings").upsert({ key: "invoice_enabled", value: next }, { onConflict: "key" });
    if (error) setMessage(error.message); else setMessage(next === "true" ? "Facturation automatique activée ✓" : "Facturation automatique désactivée");
  }

  return <section className="invoice-admin-v245">
    <header className="invoice-admin-head-v245">
      <div><p className="eyebrow">FACTURATION</p><h2>Factures & avoirs</h2><p>Numérotation continue, TVA par produit, PDF client et avoir automatique en cas de remboursement Stripe.</p></div>
      <div className={`invoice-readiness-v245 ${ready ? "ready" : "warning"}`}><strong>{ready ? "✓ Configuration prête" : "Configuration à compléter"}</strong><small>{ready ? `${products.length} produit(s) Boutique avec TVA` : `${missingLegal.length} info(s) légale(s) · ${missingVat.length} produit(s) sans TVA`}</small></div>
    </header>

    {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}

    <div className="invoice-switch-card-v245">
      <div><strong>Facturation automatique après paiement</strong><p>Quand elle est active, une facture immuable est émise après confirmation Stripe et envoyée au client si l’e-mail automatique est activé.</p></div>
      <button type="button" className={settings.invoice_enabled === "true" ? "invoice-toggle-v245 active" : "invoice-toggle-v245"} onClick={toggleEnabled}><span></span>{settings.invoice_enabled === "true" ? "Activée" : "Désactivée"}</button>
    </div>

    <div className="invoice-admin-grid-v245">
      <section className="invoice-panel-v245">
        <div className="invoice-panel-title-v245"><div><h3>Identité légale du vendeur</h3><p>Ces données sont figées dans chaque facture au moment de son émission.</p></div></div>
        <div className="form-grid">
          <label>Raison sociale *<input value={settings.invoice_legal_name} onChange={(e) => set("invoice_legal_name", e.target.value)} placeholder="Ex. RUBIKZEN" /></label>
          <label>Nom commercial<input value={settings.invoice_trade_name} onChange={(e) => set("invoice_trade_name", e.target.value)} placeholder="ICHIGO ICHIE" /></label>
          <label>Adresse *<input value={settings.invoice_address1} onChange={(e) => set("invoice_address1", e.target.value)} /></label>
          <label>Complément<input value={settings.invoice_address2} onChange={(e) => set("invoice_address2", e.target.value)} /></label>
          <label>Code postal *<input value={settings.invoice_postal_code} onChange={(e) => set("invoice_postal_code", e.target.value.replace(/\D/g, "").slice(0, 5))} /></label>
          <label>Ville *<input value={settings.invoice_city} onChange={(e) => set("invoice_city", e.target.value)} /></label>
          <label>SIREN *<input value={settings.invoice_siren} onChange={(e) => set("invoice_siren", e.target.value)} /></label>
          <label>SIRET<input value={settings.invoice_siret} onChange={(e) => set("invoice_siret", e.target.value)} /></label>
          <label>N° TVA intracommunautaire<input value={settings.invoice_vat_number} onChange={(e) => set("invoice_vat_number", e.target.value)} /></label>
          <label>RCS<input value={settings.invoice_rcs} onChange={(e) => set("invoice_rcs", e.target.value)} placeholder="Ex. RCS Nice ..." /></label>
          <label>Capital social<input value={settings.invoice_capital} onChange={(e) => set("invoice_capital", e.target.value)} placeholder="Ex. 1 000 €" /></label>
          <label>Pays<input value={settings.invoice_country} onChange={(e) => set("invoice_country", e.target.value)} /></label>
          <label>Email<input type="email" value={settings.invoice_email} onChange={(e) => set("invoice_email", e.target.value)} /></label>
          <label>Téléphone<input value={settings.invoice_phone} onChange={(e) => set("invoice_phone", e.target.value)} /></label>
        </div>
      </section>

      <section className="invoice-panel-v245">
        <div className="invoice-panel-title-v245"><div><h3>Règles documentaires</h3><p>Les numéros sont attribués par année dans une séquence transactionnelle continue.</p></div></div>
        <div className="form-grid">
          <label>Préfixe facture<input value={settings.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12))} /></label>
          <label>Préfixe avoir<input value={settings.credit_note_prefix} onChange={(e) => set("credit_note_prefix", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12))} /></label>
          <label>TVA livraison (%)<input type="number" min="0" max="100" step="0.1" value={settings.invoice_shipping_vat_rate} onChange={(e) => set("invoice_shipping_vat_rate", e.target.value)} /><small>À valider selon votre traitement comptable des frais de transport.</small></label>
          <label className="invoice-check-v245"><input type="checkbox" checked={settings.invoice_auto_email === "true"} onChange={(e) => set("invoice_auto_email", e.target.checked ? "true" : "false")} /><span>Envoyer automatiquement le PDF au client</span></label>
          <label className="cms-wide-field">Pied de facture<textarea rows={3} value={settings.invoice_footer} onChange={(e) => set("invoice_footer", e.target.value)} /></label>
        </div>
        <button type="button" className="button primary" disabled={saving} onClick={saveSettings}>{saving ? "Enregistrement…" : "Enregistrer la facturation"}</button>
      </section>
    </div>

    <section className="invoice-panel-v245 invoice-vat-panel-v245">
      <div className="invoice-panel-title-v245"><div><h3>TVA des produits Boutique</h3><p>Le taux est copié dans la commande au moment de l’achat puis figé dans la facture. Vérifiez les taux applicables avec votre comptable.</p></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un produit…" /></div>
      {missingVat.length > 0 && <div className="invoice-vat-warning-v245"><strong>{missingVat.length} produit(s) sans taux</strong><div><button type="button" onClick={() => applyRateToMissing(5.5)}>Appliquer 5,5 %</button><button type="button" onClick={() => applyRateToMissing(10)}>10 %</button><button type="button" onClick={() => applyRateToMissing(20)}>20 %</button></div></div>}
      <div className="invoice-vat-list-v245">{filtered.map((product) => <div className={`invoice-vat-row-v245 ${product.vat_rate == null ? "missing" : ""}`} key={product.id}><div><strong>{product.name_fr}</strong><small>{product.active ? "Visible" : "Masqué"}</small></div><label>TVA<input type="number" min="0" max="100" step="0.1" value={product.vat_rate ?? ""} placeholder="—" onChange={(e) => setProducts((current) => current.map((item) => item.id === product.id ? { ...item, vat_rate: e.target.value === "" ? null : Number(e.target.value) } : item))} /><span>%</span></label><button type="button" className="button ghost small" onClick={() => saveVat(product)}>Sauver</button></div>)}</div>
    </section>

    <div className="invoice-legal-note-v245"><strong>À savoir</strong><p>Le module génère un PDF et conserve une copie structurée immuable. Il prépare le site à une future connexion avec une plateforme agréée, mais le PDF seul n’est pas le format d’e-facturation B2B de la réforme française.</p></div>
  </section>;
}
