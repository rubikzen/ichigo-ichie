"use client";

import { useEffect, useMemo, useState } from "react";
import type { createBrowserSupabase } from "@/lib/supabase/browser";
import { broadcastSiteSettingsUpdate } from "@/lib/settings-events";

type PromoRow = {
  id: string;
  code: string;
  campaign_name: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  usage_limit: number | null;
  used_count: number;
  reserved_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type SupabaseBrowser = NonNullable<ReturnType<typeof createBrowserSupabase>>;

type NewPromoDraft = {
  code: string;
  campaignName: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
};

const EMPTY_DRAFT: NewPromoDraft = {
  code: "",
  campaignName: "",
  discountType: "percent",
  discountValue: 10,
  active: true,
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function promoStatus(promo: PromoRow) {
  if (!promo.active) return { label: "Inactif", className: "inactive", usable: false };
  const now = Date.now();
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) return { label: "Planifié", className: "scheduled", usable: false };
  if (promo.ends_at && new Date(promo.ends_at).getTime() < now) return { label: "Expiré", className: "expired", usable: false };
  if (promo.usage_limit != null && promo.used_count + promo.reserved_count >= promo.usage_limit) return { label: "Limite atteinte", className: "expired", usable: false };
  return { label: "Utilisable maintenant", className: "active", usable: true };
}

function discountLabel(type: "percent" | "fixed", value: number) {
  const number = Number(value || 0);
  if (type === "percent") return `−${number.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  return `−${number.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function PromotionsAdmin({ supabase }: { supabase: SupabaseBrowser }) {
  const [promos, setPromos] = useState<PromoRow[]>([]);
  const [fieldVisible, setFieldVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<NewPromoDraft>(EMPTY_DRAFT);

  async function load() {
    setLoading(true);
    const [{ data: promoRows, error: promoError }, { data: settingRow }] = await Promise.all([
      supabase.from("promo_codes").select("*").order("created_at", { ascending: false }),
      supabase.from("site_settings").select("key,value").eq("key", "promo_field_visible").maybeSingle(),
    ]);
    if (promoError) setMessage(promoError.message);
    else setPromos((promoRows ?? []) as PromoRow[]);
    const raw = settingRow?.value;
    setFieldVisible(raw == null ? true : String(raw) !== "false");
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setCheckoutVisibility(next: boolean) {
    setFieldVisible(next);
    const { error } = await supabase.from("site_settings").upsert({ key: "promo_field_visible", value: next ? "true" : "false" }, { onConflict: "key" });
    setMessage(error ? error.message : next ? "Champ code promo affiché au checkout ✓" : "Champ code promo masqué au checkout ✓");
    if (!error) broadcastSiteSettingsUpdate();
  }

  async function createPromo() {
    const code = normalizeCode(draft.code);
    const discountValue = Number(draft.discountValue);
    if (code.length < 2) return setMessage("Saisissez un code d’au moins 2 caractères.");
    if (!discountValue || discountValue <= 0) return setMessage("La réduction doit être supérieure à 0.");
    if (draft.discountType === "percent" && discountValue > 100) return setMessage("Une réduction en pourcentage ne peut pas dépasser 100 %.");

    setCreating(true);
    setMessage("");
    const { data, error } = await supabase.from("promo_codes").insert({
      code,
      campaign_name: draft.campaignName.trim() || code,
      discount_type: draft.discountType,
      discount_value: discountValue,
      min_order_amount: 0,
      max_discount_amount: null,
      starts_at: null,
      ends_at: null,
      usage_limit: null,
      active: draft.active,
    }).select("*").single();
    setCreating(false);

    if (error) {
      if ((error as { code?: string }).code === "23505") return setMessage(`Le code ${code} existe déjà.`);
      return setMessage(error.message);
    }

    setPromos((current) => [data as PromoRow, ...current]);
    setDraft(EMPTY_DRAFT);
    setFilter("");
    setShowCreate(false);
    setMessage(draft.active
      ? `Code ${code} créé et ACTIF ✓ — il peut être utilisé immédiatement au checkout.`
      : `Code ${code} créé en mode inactif ✓`);
  }

  async function savePromo(promo: PromoRow) {
    const code = normalizeCode(promo.code);
    const discountValue = Number(promo.discount_value);
    if (code.length < 2) return setMessage("Saisissez un code d’au moins 2 caractères.");
    if (!discountValue || discountValue <= 0) return setMessage("La réduction doit être supérieure à 0.");
    if (promo.discount_type === "percent" && discountValue > 100) return setMessage("Une réduction en pourcentage ne peut pas dépasser 100 %.");

    setSavingId(promo.id);
    setMessage("");
    const { error } = await supabase.from("promo_codes").update({
      code,
      campaign_name: promo.campaign_name.trim() || code,
      discount_type: promo.discount_type,
      discount_value: discountValue,
      min_order_amount: Math.max(0, Number(promo.min_order_amount || 0)),
      max_discount_amount: promo.max_discount_amount == null || promo.max_discount_amount === 0 ? null : Math.max(0, Number(promo.max_discount_amount)),
      starts_at: promo.starts_at,
      ends_at: promo.ends_at,
      usage_limit: promo.usage_limit == null || promo.usage_limit === 0 ? null : Math.max(1, Math.floor(Number(promo.usage_limit))),
      active: promo.active,
      updated_at: new Date().toISOString(),
    }).eq("id", promo.id);
    setSavingId("");
    if (error) {
      if ((error as { code?: string }).code === "23505") return setMessage(`Le code ${code} existe déjà.`);
      return setMessage(error.message);
    }
    setMessage(promo.active ? `Code ${code} enregistré ✓ — actif au checkout.` : `Code ${code} enregistré ✓ — inactif.`);
    await load();
  }

  async function toggleActive(promo: PromoRow, next: boolean) {
    patch(promo.id, { active: next });
    setMessage("");
    const { error } = await supabase.from("promo_codes").update({ active: next, updated_at: new Date().toISOString() }).eq("id", promo.id);
    if (error) {
      patch(promo.id, { active: !next });
      return setMessage(error.message);
    }
    setMessage(next
      ? `Code ${promo.code} activé ✓ — il est utilisable immédiatement si ses dates et limites le permettent.`
      : `Code ${promo.code} désactivé ✓ — il n’est plus accepté au checkout.`);
    await load();
  }

  async function duplicatePromo(promo: PromoRow) {
    const base = normalizeCode(`${promo.code}-COPY`).slice(0, 40);
    const { data, error } = await supabase.from("promo_codes").insert({
      code: base,
      campaign_name: `${promo.campaign_name} — copie`,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      min_order_amount: promo.min_order_amount,
      max_discount_amount: promo.max_discount_amount,
      starts_at: null,
      ends_at: null,
      usage_limit: promo.usage_limit,
      active: false,
    }).select("*").single();
    if (error) return setMessage(error.message);
    setPromos((current) => [data as PromoRow, ...current]);
    setFilter("");
    setMessage("Code dupliqué en mode inactif ✓");
  }

  async function deletePromo(promo: PromoRow) {
    if (promo.used_count > 0) return setMessage("Un code déjà utilisé doit être désactivé plutôt que supprimé.");
    if (!window.confirm(`Supprimer définitivement le code ${promo.code} ?`)) return;
    const { error } = await supabase.from("promo_codes").delete().eq("id", promo.id);
    if (error) return setMessage(error.message);
    setPromos((current) => current.filter((item) => item.id !== promo.id));
    setMessage("Code supprimé ✓");
  }

  function patch(id: string, values: Partial<PromoRow>) {
    setPromos((current) => current.map((item) => item.id === id ? { ...item, ...values } : item));
  }

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return promos;
    return promos.filter((promo) => `${promo.code} ${promo.campaign_name}`.toLowerCase().includes(needle));
  }, [promos, filter]);

  return <div className="promotions-admin-v234 promotions-admin-v2341">
    <div className="section-inline promo-admin-heading-v234">
      <div>
        <p className="eyebrow">PROMOTIONS</p>
        <h2>Codes promo & campagnes</h2>
        <p className="muted">Créez un code, choisissez la réduction, puis activez-le. Un code actif enregistré est accepté immédiatement au checkout.</p>
      </div>
      <button type="button" className="button primary" onClick={() => { setShowCreate((current) => !current); setMessage(""); }}>
        {showCreate ? "Fermer" : "+ Nouveau code"}
      </button>
    </div>

    {showCreate && <section className="promo-create-card-v2341">
      <div className="promo-create-title-v2341">
        <div><p className="eyebrow">NOUVEAU CODE</p><h3>Créer une promotion</h3></div>
        <span className="promo-create-help-v2341">1. Code → 2. Réduction → 3. Actif → 4. Créer</span>
      </div>

      <div className="promo-create-grid-v2341">
        <label className="promo-create-code-v2341">Code promo
          <input
            value={draft.code}
            onChange={(e) => setDraft((current) => ({ ...current, code: normalizeCode(e.target.value) }))}
            placeholder="EX. ICHIGO10"
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
          />
          <small>Sans espace. Le code sera automatiquement mis en majuscules.</small>
        </label>

        <label>Nom de la campagne <span className="optional-label-v2341">facultatif</span>
          <input value={draft.campaignName} onChange={(e) => setDraft((current) => ({ ...current, campaignName: e.target.value }))} placeholder="Ex. Japan Manga Wave" autoComplete="off" />
        </label>
      </div>

      <div className="promo-discount-builder-v2341">
        <div>
          <span className="promo-field-label-v2341">Type de réduction</span>
          <div className="promo-type-switch-v2341">
            <button type="button" className={draft.discountType === "percent" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, discountType: "percent" }))}>% Pourcentage</button>
            <button type="button" className={draft.discountType === "fixed" ? "active" : ""} onClick={() => setDraft((current) => ({ ...current, discountType: "fixed" }))}>€ Montant fixe</button>
          </div>
        </div>

        <label className="promo-discount-value-v2341">Réduction
          <div className="promo-number-with-unit-v2341">
            <input type="number" min="0.01" max={draft.discountType === "percent" ? 100 : undefined} step="0.01" value={draft.discountValue} onChange={(e) => setDraft((current) => ({ ...current, discountValue: Number(e.target.value) }))} />
            <strong>{draft.discountType === "percent" ? "%" : "€"}</strong>
          </div>
        </label>

        <div className="promo-preview-v2341">
          <span>Aperçu</span>
          <strong>{discountLabel(draft.discountType, draft.discountValue)}</strong>
          <small>{draft.discountType === "percent" ? "sur le sous-total produits" : "sur le sous-total produits"}</small>
        </div>
      </div>

      <div className="promo-create-footer-v2341">
        <label className="promo-active-create-v2341">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((current) => ({ ...current, active: e.target.checked }))} />
          <span><strong>Actif dès la création</strong><small>Le code pourra être utilisé immédiatement après avoir cliqué sur « Créer le code ».</small></span>
        </label>
        <button type="button" className="button primary promo-create-submit-v2341" disabled={creating || draft.code.length < 2 || Number(draft.discountValue) <= 0} onClick={createPromo}>
          {creating ? "Création…" : "Créer le code"}
        </button>
      </div>
    </section>}

    <div className="promo-checkout-toggle-v234">
      <div><strong>Champ « Code promo » au checkout</strong><small>Visible = le client peut saisir un code. Masqué = aucun code n’est accepté au checkout.</small></div>
      <label className="promo-switch-v234"><input type="checkbox" checked={fieldVisible} onChange={(e) => setCheckoutVisibility(e.target.checked)} /><span></span><b>{fieldVisible ? "Visible" : "Masqué"}</b></label>
    </div>

    {message && <p className={message.includes("✓") ? "save-message success" : "save-message"}>{message}</p>}

    <section className="promo-saved-section-v2341">
      <div className="promo-saved-heading-v2341">
        <div><p className="eyebrow">CODES ENREGISTRÉS</p><h3>{promos.length} code{promos.length > 1 ? "s" : ""}</h3></div>
        {promos.length > 4 && <label className="promo-filter-v2341">Filtrer
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nom ou code…" autoComplete="off" name="promo-admin-filter-no-autofill" />
        </label>}
      </div>

      {loading ? <div className="empty-state">Chargement des promotions…</div> : filtered.length ? <div className="promo-card-list-v234">{filtered.map((promo) => {
        const status = promoStatus(promo);
        return <article className={`promo-admin-card-v234 status-${status.className}`} key={promo.id}>
          <div className="promo-admin-card-head-v234 promo-admin-card-head-v2341">
            <div>
              <span className={`promo-status-v234 ${status.className}`}>{status.label}</span>
              <div className="promo-card-identity-v2341"><strong>{promo.code}</strong><span>{discountLabel(promo.discount_type, promo.discount_value)}</span></div>
            </div>
            <label className="promo-switch-v234 promo-active-switch-v2341">
              <input type="checkbox" checked={promo.active} onChange={(e) => toggleActive(promo, e.target.checked)} />
              <span></span><b>{promo.active ? "Actif" : "Inactif"}</b>
            </label>
          </div>

          <div className="promo-main-grid-v234 promo-main-grid-v2341">
            <label>Code<input className="promo-code-input-v234" value={promo.code} maxLength={40} autoComplete="off" spellCheck={false} onChange={(e) => patch(promo.id, { code: normalizeCode(e.target.value) })} /></label>
            <label>Campagne<input value={promo.campaign_name} onChange={(e) => patch(promo.id, { campaign_name: e.target.value })} /></label>
            <label>Type<select value={promo.discount_type} onChange={(e) => patch(promo.id, { discount_type: e.target.value as "percent" | "fixed" })}><option value="percent">Pourcentage (%)</option><option value="fixed">Montant fixe (€)</option></select></label>
            <label>Réduction
              <div className="promo-number-with-unit-v2341 compact"><input type="number" min="0.01" max={promo.discount_type === "percent" ? 100 : undefined} step="0.01" value={promo.discount_value} onChange={(e) => patch(promo.id, { discount_value: Number(e.target.value) })} /><strong>{promo.discount_type === "percent" ? "%" : "€"}</strong></div>
            </label>
            <label>Commande minimum (€)<input type="number" min="0" step="0.01" value={promo.min_order_amount} onChange={(e) => patch(promo.id, { min_order_amount: Number(e.target.value) })} /></label>
            {promo.discount_type === "percent" && <label>Plafond réduction (€)<input type="number" min="0" step="0.01" placeholder="Aucun" value={promo.max_discount_amount ?? ""} onChange={(e) => patch(promo.id, { max_discount_amount: e.target.value === "" ? null : Number(e.target.value) })} /></label>}
            <label>Limite d’utilisations<input type="number" min="1" step="1" placeholder="Illimitée" value={promo.usage_limit ?? ""} onChange={(e) => patch(promo.id, { usage_limit: e.target.value === "" ? null : Number(e.target.value) })} /></label>
          </div>

          <details className="promo-advanced-v2341">
            <summary>Options avancées · dates et limites</summary>
            <div className="promo-date-grid-v234"><label>Début<input type="datetime-local" value={toLocalInput(promo.starts_at)} onChange={(e) => patch(promo.id, { starts_at: fromLocalInput(e.target.value) })} /></label><label>Fin<input type="datetime-local" value={toLocalInput(promo.ends_at)} onChange={(e) => patch(promo.id, { ends_at: fromLocalInput(e.target.value) })} /></label></div>
          </details>

          <div className="promo-usage-v234"><span><strong>{promo.used_count}</strong> utilisée{promo.used_count > 1 ? "s" : ""}</span>{promo.reserved_count > 0 && <span><strong>{promo.reserved_count}</strong> réservation{promo.reserved_count > 1 ? "s" : ""} paiement</span>}{promo.usage_limit != null && <span>sur <strong>{promo.usage_limit}</strong> maximum</span>}</div>

          <div className="promo-actions-v234 promo-actions-v2341">
            <div className="promo-live-hint-v2341">{status.usable ? <><span className="dot"></span>Ce code peut être appliqué maintenant au checkout.</> : <>Enregistrez les modifications avant de tester le code.</>}</div>
            <div className="promo-action-buttons-v2341">
              <button type="button" className="button primary small" disabled={savingId === promo.id} onClick={() => savePromo(promo)}>{savingId === promo.id ? "Enregistrement…" : "Enregistrer les modifications"}</button>
              <button type="button" className="button ghost small" onClick={() => duplicatePromo(promo)}>Dupliquer</button>
              <button type="button" className="button ghost small text-danger" onClick={() => deletePromo(promo)}>Supprimer</button>
            </div>
          </div>
        </article>;
      })}</div> : <div className="empty-state">Aucun code promo enregistré.</div>}
    </section>
  </div>;
}
