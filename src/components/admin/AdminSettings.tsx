"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { broadcastSiteSettingsUpdate } from "@/lib/settings-events";
import { SiteMediaField, SiteMediaLibrary } from "../SiteMediaField";

export function SettingsAdmin({ settings, setSettings, supabase, reload, active, onDirtyChange }: { settings: Record<string, string>; setSettings: (next: Record<string, string>) => void; supabase: NonNullable<ReturnType<typeof createBrowserSupabase>>; reload: () => Promise<void>; active: boolean; onDirtyChange: (dirty: boolean) => void }) {
  const [savingCms, setSavingCms] = useState(false);
  const [cmsMessage, setCmsMessage] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const savedSettingsRef = useRef<Record<string, string>>({ ...settings });
  const savedFlashTimerRef = useRef<number | null>(null);
  const [settingsPanel, setSettingsPanel] = useState("identity");
  const [settingsMenuSearch, setSettingsMenuSearch] = useState("");

  function markDirty() {
    setHasUnsavedChanges(true);
    onDirtyChange(true);
    setSavedFlash(false);
    setCmsMessage("");
  }

  const set = (key: string, value: string) => { setSettings({ ...settings, [key]: value }); markDirty(); };
  const toggle = (key: string) => { setSettings({ ...settings, [key]: settings[key] === "false" ? "true" : "false" }); markDirty(); };

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const shortcut = (event: KeyboardEvent) => {
      if (!active || !hasUnsavedChanges || savingCms) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", shortcut);
    };
  }, [active, hasUnsavedChanges, savingCms]);

  useEffect(() => () => { if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current); }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!hasUnsavedChanges || savingCms) return;
    setSavingCms(true); setCmsMessage("");
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase.from("site_settings").upsert(rows);
    setSavingCms(false);
    if (error) return setCmsMessage(error.message);
    savedSettingsRef.current = { ...settings };
    setHasUnsavedChanges(false);
    onDirtyChange(false);
    setSavedFlash(true);
    setCmsMessage("Site enregistré ✓");
    await reload();
    broadcastSiteSettingsUpdate();
    if (savedFlashTimerRef.current) window.clearTimeout(savedFlashTimerRef.current);
    savedFlashTimerRef.current = window.setTimeout(() => setSavedFlash(false), 2200);
  }

  function discardChanges() {
    setSettings({ ...savedSettingsRef.current });
    setHasUnsavedChanges(false);
    onDirtyChange(false);
    setSavedFlash(false);
    setCmsMessage("Modifications annulées.");
  }

  const text = (key: string, label: string, placeholder = "") => <label>{label}<input value={settings[key] ?? ""} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} /></label>;
  const area = (key: string, label: string, rows = 3) => <label className="cms-wide-field">{label}<textarea rows={rows} value={settings[key] ?? ""} onChange={(e) => set(key, e.target.value)} /></label>;
  const bilingual = (base: string, label: string, multiline = false) => <div className="cms-bilingual"><h4>{label}</h4><div className="form-grid">{multiline ? area(`${base}_fr`, "FR") : text(`${base}_fr`, "FR")}{multiline ? area(`${base}_en`, "EN") : text(`${base}_en`, "EN")}</div></div>;
  const legalPageEditor = (base: string, label: string, href: string) => <article className="legal-editor-card-v231">
    <div className="legal-editor-card-head-v231"><div><span className="legal-editor-kicker-v231">PAGE D’INFORMATION</span><h3>{label}</h3></div><a className="button ghost small" href={href} target="_blank" rel="noreferrer">Aperçu ↗</a></div>
    <div className="legal-editor-fields-v231">
      {bilingual(`${base}_label`, "Nom du lien dans le footer")}
      {bilingual(`${base}_title`, "Titre de la page")}
      <div className="cms-bilingual legal-content-editor-v231"><div className="legal-content-title-v231"><h4>Contenu de la page</h4><small>Astuce : ligne vide = nouveau paragraphe · ## = titre secondaire · - = liste à puces · 1. = liste numérotée.</small></div><div className="form-grid"><label className="cms-wide-field"><span>FR</span><textarea rows={14} value={settings[`${base}_body_fr`] ?? ""} placeholder="Saisissez le contenu complet en français…" onChange={(e) => set(`${base}_body_fr`, e.target.value)} /><small>{(settings[`${base}_body_fr`] || "").length.toLocaleString("fr-FR")} caractères</small></label><label className="cms-wide-field"><span>EN</span><textarea rows={14} value={settings[`${base}_body_en`] ?? ""} placeholder="Enter the full English content…" onChange={(e) => set(`${base}_body_en`, e.target.value)} /><small>{(settings[`${base}_body_en`] || "").length.toLocaleString("fr-FR")} caractères</small></label></div></div>
    </div>
  </article>;
  const settingsPanels = [
    { id: "identity", group: "Contenu", label: "Identité & navigation", hint: "Logo, marque, menus" },
    { id: "home", group: "Contenu", label: "Page d’accueil", hint: "Hero & présentation" },
    { id: "shop", group: "Contenu", label: "Boutique", hint: "Catalogue & tri" },
    { id: "menu", group: "Contenu", label: "La carte", hint: "Textes du menu" },
    { id: "contact", group: "Contenu", label: "Contact", hint: "Formulaire public" },
    { id: "media", group: "Contenu", label: "Médias & images", hint: "Bibliothèque d’images" },
    { id: "cart", group: "Vente", label: "Panier & checkout", hint: "Commande & paiement" },
    { id: "shipping", group: "Vente", label: "Livraison & tarifs", hint: "Modes & poids" },
    { id: "footer", group: "Entreprise", label: "Boutique physique & footer", hint: "Coordonnées, horaires & liens" },
    { id: "legal", group: "Entreprise", label: "Informations légales", hint: "CGV & confidentialité" },
    { id: "seo", group: "Visibilité", label: "SEO", hint: "Moteurs de recherche" },
    { id: "theme", group: "Visibilité", label: "Couleurs & style", hint: "Identité visuelle" },
    { id: "logistics", group: "Avancé", label: "Technique", hint: "Paramètres avancés" },
  ] as const;

  const filteredSettingsPanels = settingsPanels.filter((item) => {
    const query = settingsMenuSearch.trim().toLocaleLowerCase("fr");
    if (!query) return true;
    return `${item.label} ${item.hint} ${item.group}`.toLocaleLowerCase("fr").includes(query);
  });

  function selectSettingsPanel(id: string) {
    setSettingsPanel(id);
    window.requestAnimationFrame(() => {
      const content = document.querySelector<HTMLElement>(".settings-content-v238");
      content?.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  const panel = (id: string, title: string, subtitle: string, children: ReactNode) => settingsPanel === id ? <section className="cms-panel-v238" aria-labelledby={`settings-panel-${id}`}>
    <div className="cms-panel-head-v238" id="settings-panel-top-v238"><div><span>RÉGLAGES</span><h3 id={`settings-panel-${id}`}>{title}</h3><p>{subtitle}</p></div><small>{settingsPanels.find((item) => item.id === id)?.hint}</small></div>
    <div className="cms-panel-body-v238">{children}</div>
  </section> : null;

  return <div className="settings-stack settings-stack-v218">
    <form ref={formRef} className="visual-cms-admin visual-cms-admin-v229" onSubmit={save}>
      <div className="cms-admin-hero cms-admin-hero-v238"><div><p className="eyebrow">VISUAL CMS</p><h2>Réglages du site</h2><p>Choisissez une rubrique : une seule zone s’affiche à la fois pour modifier le site plus rapidement.</p></div><div className="cms-save-zone cms-save-zone-v229">{cmsMessage ? <small className={cmsMessage.includes("✓") ? "success" : cmsMessage.includes("annul") ? "muted" : "error"}>{cmsMessage}</small> : <small className="muted">⌘ S pour enregistrer à tout moment.</small>}<kbd>⌘ S</kbd></div></div>

      <div className="settings-hub-v238">
        <aside className="settings-sidebar-v238" aria-label="Rubriques des réglages">
          <div className="settings-sidebar-search-v238"><label htmlFor="settings-search-v238">Rechercher</label><input id="settings-search-v238" value={settingsMenuSearch} placeholder="Ex. livraison, logo, SEO…" onChange={(event) => setSettingsMenuSearch(event.target.value)} /></div>
          <div className="settings-sidebar-list-v238">
            {["Contenu", "Vente", "Entreprise", "Visibilité", "Avancé"].map((group) => {
              const items = filteredSettingsPanels.filter((item) => item.group === group);
              if (!items.length) return null;
              return <div className="settings-sidebar-group-v238" key={group}><span className="settings-sidebar-group-label-v238">{group}</span><div>{items.map((item) => <button type="button" key={item.id} className={settingsPanel === item.id ? "is-active" : ""} onClick={() => selectSettingsPanel(item.id)}><strong>{item.label}</strong><small>{item.hint}</small>{settingsPanel === item.id && <b aria-hidden="true">→</b>}</button>)}</div></div>;
            })}
            {!filteredSettingsPanels.length && <p className="settings-sidebar-empty-v238">Aucune rubrique trouvée.</p>}
          </div>
          {hasUnsavedChanges && <div className="settings-sidebar-dirty-v238"><span></span> Modifications non enregistrées</div>}
        </aside>
        <main className="settings-content-v238">

      {panel("media", "Médias & images", "Ajoutez et réutilisez les images générales de l’interface", <SiteMediaLibrary supabase={supabase} />)}

      {panel("identity", "Identité & navigation", "Nom, logo, bannière et noms des menus", <>
        <div className="cms-toggle-row"><label><input type="checkbox" checked={settings.announcement_visible !== "false"} onChange={() => toggle("announcement_visible")} /> Afficher la bannière supérieure</label></div>
        <div className="form-grid">{text("brand_name", "Nom de la marque")}<SiteMediaField supabase={supabase} label="Logo principal" help="Utilisé dans le header et, si activé, dans le footer." slot="logo" compact value={settings.brand_logo_url || ""} onChange={(value) => set("brand_logo_url", value)} /></div>
        {bilingual("brand_subtitle", "Sous-titre sous le logo")}
        {bilingual("announcement", "Bannière supérieure")}
        <div className="cms-subsection"><h3>Navigation</h3>{bilingual("nav_menu", "Menu")}{bilingual("nav_shop", "Boutique")}{bilingual("nav_house", "La maison")}{bilingual("nav_contact", "Contact")}{bilingual("nav_cart", "Panier")}</div>
      </>)}

      {panel("home", "Page d’accueil", "Hero, incontournables et présentation de la maison", <>
        <div className="cms-toggle-grid">
          {[ ["home_hero_visible","Hero"], ["home_featured_visible","Incontournables"], ["home_story_visible","Présentation"] ].map(([key,label]) => <label key={key}><input type="checkbox" checked={settings[key] !== "false"} onChange={() => toggle(key)} /> {label}</label>)}
        </div>
        <div className="cms-subsection"><h3>Hero</h3>{bilingual("home_eyebrow", "Petit titre")}{bilingual("home_title", "Grand titre", true)}{bilingual("home_intro", "Introduction", true)}<div className="cms-media-full"><SiteMediaField supabase={supabase} label="Image principale du hero" help="Photo large affichée en haut de la page." slot="hero" value={settings.home_hero_image_url || ""} onChange={(value) => set("home_hero_image_url", value)} /></div>{bilingual("home_primary_cta", "Bouton principal")}{bilingual("home_secondary_cta", "Bouton secondaire")}{bilingual("home_hero_note1", "Pastille image")}</div>
        <div className="cms-subsection"><h3>Incontournables</h3>{bilingual("featured_eyebrow", "Petit titre")}{bilingual("featured_title", "Titre")}</div>
        <div className="cms-subsection"><h3>Présentation / La maison</h3>{bilingual("story_eyebrow", "Petit titre")}{bilingual("story_title", "Titre")}{bilingual("story_text", "Texte", true)}{bilingual("story_link", "Lien vers la carte")}{text("story_card_label", "Nom affiché sur l’image")}{bilingual("story_address_label", "Libellé adresse")}{bilingual("story_hours_label", "Libellé horaires")}{bilingual("story_phone_label", "Libellé téléphone")}{bilingual("story_maps_cta", "Bouton itinéraire")}{bilingual("story_instagram_cta", "Bouton Instagram")}<div className="cms-media-full"><SiteMediaField supabase={supabase} label="Image La maison" help="Photo de la boutique, de l’espace ou de l’univers Ichigo Ichie." slot="story" value={settings.story_image_url || ""} onChange={(value) => set("story_image_url", value)} /></div></div>
      </>)}

      {panel("menu", "La carte", "Présentation uniquement : aucun panier ni commande en ligne", <>{bilingual("menu_eyebrow", "Petit titre")}{bilingual("menu_title", "Titre")}{bilingual("menu_intro", "Introduction", true)}{bilingual("menu_info_note", "Message information", true)}{bilingual("menu_all", "Bouton Toutes catégories")}{bilingual("menu_empty", "Message quand aucun résultat", true)}</>)}

      {panel("shop", "Boutique", "Titres, introduction, catégories et tri", <>
      <div className="cms-toggle-row">
        <label>
          <input
            type="checkbox"
            checked={settings.shop_ritual_bundle_visible !== "false"}
            onChange={() => toggle("shop_ritual_bundle_visible")}
          />{" "}
          Afficher Composez votre rituel
        </label>
      </div>
      <div className="cms-subsection">
        <h3>Offre Composez votre rituel</h3>
        <div className="form-grid">
          <label>
            Composition
            <select
              value={settings.shop_ritual_bundle_mode || "matcha_accessory"}
              onChange={(event) =>
                set("shop_ritual_bundle_mode", event.target.value)
              }
            >
              <option value="matcha_accessory">Matcha + accessoire</option>
              <option value="two_matcha">2 matchas</option>
            </select>
          </label>
          <label>
            Réduction (%)
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={settings.shop_ritual_bundle_discount_percent ?? "5"}
              onChange={(event) =>
                set(
                  "shop_ritual_bundle_discount_percent",
                  event.target.value,
                )
              }
            />
          </label>
        </div>
        <small>
          Le prix et la composition sont revérifiés côté serveur au moment
          de la commande. Maximum autorisé : 50 %.
        </small>
      </div>
      <div className="cms-subsection">
        <h3>Avis clients</h3>
        <div className="cms-toggle-grid">
          <label><input type="checkbox" checked={settings.shop_reviews_enabled !== "false"} onChange={() => toggle("shop_reviews_enabled")} /> Activer les avis clients</label>
          <label><input type="checkbox" checked={settings.shop_reviews_show_rating !== "false"} onChange={() => toggle("shop_reviews_show_rating")} /> Afficher les notes et étoiles</label>
          <label><input type="checkbox" checked={settings.shop_reviews_verified_badge_visible !== "false"} onChange={() => toggle("shop_reviews_verified_badge_visible")} /> Afficher le badge Achat vérifié</label>
          <label><input type="checkbox" checked={settings.shop_reviews_admin_reply_visible !== "false"} onChange={() => toggle("shop_reviews_admin_reply_visible")} /> Afficher les réponses Ichigo Ichie</label>
          <label><input type="checkbox" checked={settings.shop_reviews_card_rating_visible !== "false"} onChange={() => toggle("shop_reviews_card_rating_visible")} /> Afficher ★ note · avis sur les fiches catalogue</label>
        </div>
        <div className="form-grid">
          <label>
            Publication des nouveaux avis
            <select value={settings.shop_reviews_moderation_mode || "manual"} onChange={(event) => set("shop_reviews_moderation_mode", event.target.value)}>
              <option value="manual">Validation manuelle</option>
              <option value="auto">Publication automatique</option>
            </select>
          </label>
          <label>
            Nombre d’avis affichés au départ
            <input type="number" min="1" max="20" step="1" value={settings.shop_reviews_initial_limit ?? "6"} onChange={(event) => set("shop_reviews_initial_limit", event.target.value)} />
          </label>
        </div>
        <small>Même en publication automatique, un avis reste réservé à un produit réellement acheté dans une commande payée et terminée.</small>
      </div>
      {bilingual("shop_eyebrow", "Petit titre")}{bilingual("shop_title", "Titre")}{bilingual("shop_intro", "Introduction", true)}{bilingual("shop_all", "Bouton Toutes catégories")}{bilingual("shop_empty", "Message quand aucun résultat", true)}<div className="cms-subsection"><h3>Tri catalogue</h3>{bilingual("catalog_sort_label", "Libellé")}{bilingual("catalog_sort_recommended", "Ordre recommandé")}{bilingual("catalog_sort_price_asc", "Prix croissant")}{bilingual("catalog_sort_price_desc", "Prix décroissant")}{bilingual("catalog_sort_name_asc", "Nom A → Z")}{bilingual("catalog_sort_name_desc", "Nom Z → A")}</div><div className="cms-subsection"><h3>Navigation mobile</h3>{bilingual("mobile_menu_label", "Carte")}{bilingual("mobile_house_label", "Maison")}</div></>)}


      {panel("contact", "Contact", "Formulaire public et champs obligatoires", <><div className="cms-toggle-row"><label><input type="checkbox" checked={settings.contact_visible !== "false"} onChange={() => toggle("contact_visible")} /> Afficher le formulaire Contact</label></div>{bilingual("contact_eyebrow", "Petit titre")}{bilingual("contact_title", "Titre")}{bilingual("contact_intro", "Introduction", true)}{bilingual("contact_reply_note", "Délai de réponse")}{bilingual("contact_first_name_label", "Libellé prénom")}{bilingual("contact_last_name_label", "Libellé nom")}{bilingual("contact_email_label", "Libellé e-mail")}{bilingual("contact_phone_label", "Libellé téléphone")}{bilingual("contact_message_label", "Libellé message")}{bilingual("contact_submit", "Bouton envoyer")}{bilingual("contact_sending", "Texte pendant l’envoi")}{bilingual("contact_success", "Message succès", true)}{bilingual("contact_error", "Message erreur", true)}{bilingual("contact_required_note", "Note champs obligatoires")}{bilingual("contact_privacy", "Note confidentialité", true)}<div className="cms-subsection"><h3>Champs obligatoires</h3><div className="cms-toggle-grid">{[["contact_first_name_required","Prénom"],["contact_last_name_required","Nom"],["contact_email_required","E-mail"],["contact_phone_required","Téléphone"],["contact_message_required","Message"]].map(([key,label]) => <label key={key}><input type="checkbox" checked={settings[key] !== "false"} onChange={() => toggle(key)} /> {label}</label>)}</div></div></>)}

      {panel("cart", "Panier & checkout", "Titres principaux affichés pendant la commande", <>
        {bilingual("cart_eyebrow", "Petit titre panier")}{bilingual("cart_title", "Titre panier")}{bilingual("cart_empty_title", "Titre panier vide")}{bilingual("cart_empty_text", "Texte panier vide", true)}
        <div className="cms-subsection"><h3>Checkout</h3>{bilingual("checkout_eyebrow", "Petit titre")}{bilingual("checkout_title", "Titre")}{bilingual("checkout_intro", "Introduction", true)}</div>
      </>)}

      {settingsPanel === "shipping" && <section className="cms-panel-v238"><div className="cms-panel-head-v238" id="settings-panel-top-v238"><div><span>VENTE</span><h3>Livraison & tarifs</h3><p>Modes de livraison, seuils de gratuité et tranches de poids.</p></div><small>Modes & poids</small></div><div className="cms-panel-body-v238 cms-panel-body-shipping-v238"><ShippingRatesAdmin supabase={supabase} /></div></section>}

      {panel("footer", "Boutique & pied de page", "Adresse, contact, réseaux et liens légaux", <><div className="cms-toggle-row"><label><input type="checkbox" checked={settings.footer_show_logo !== "false"} onChange={() => toggle("footer_show_logo")} /> Afficher le logo dans le pied de page</label></div><div className="form-grid">{text("store_address", "Adresse affichée")}{text("store_maps_url", "Lien Google Maps (optionnel)", "https://maps.app.goo.gl/…")}{text("opening_hours", "Horaires")}{text("phone", "Téléphone")}{text("support_email", "Email service client")}{text("instagram", "Instagram · URL ou @compte")}</div>{text("footer_brand", "Nom dans le footer")}{bilingual("footer_tagline", "Phrase dans le footer")}{bilingual("footer_open_prefix", "Mot avant les horaires")}{bilingual("footer_nav_title", "Titre colonne navigation")}{bilingual("footer_visit_title", "Titre colonne visite")}{bilingual("footer_follow_title", "Titre colonne réseaux")}{bilingual("footer_legal_title", "Titre colonne informations")}{bilingual("footer_maps_label", "Nom du lien Maps")}{bilingual("footer_location", "Localisation bas de page")}{text("footer_copyright_name", "Nom copyright")}</>)}

      {panel("legal", "Informations légales", "Modifiez librement les 4 pages affichées dans le footer", <><div className="setup-warning compact-warning-v227"><strong>Contenu entièrement modifiable</strong><span>Les quatre liens du footer utilisent automatiquement les titres et contenus enregistrés ici. Les textes par défaut sont uniquement des exemples de travail : remplacez-les par les informations validées de votre société avant la mise en ligne.</span></div><div className="legal-editor-grid-v231">{legalPageEditor("legal_notice", "Mentions légales", "/mentions-legales")}{legalPageEditor("terms", "Conditions générales de vente (CGV)", "/cgv")}{legalPageEditor("privacy", "Politique de confidentialité", "/confidentialite")}{legalPageEditor("shipping_returns", "Livraison & retours", "/livraison-retours")}</div></>)}

      {panel("theme", "Couleurs & style", "Personnalisez l’identité visuelle sans CSS", <><div className="theme-color-grid">{[["theme_ink","Texte"],["theme_moss","Vert secondaire"],["theme_moss_dark","Vert principal"],["theme_paper","Fond"],["theme_soft","Fond doux"]].map(([key,label]) => <label key={key}>{label}<div className="color-input-row"><input type="color" value={settings[key] || "#ffffff"} onChange={(e) => set(key,e.target.value)} /><input value={settings[key] || ""} onChange={(e) => set(key,e.target.value)} /></div></label>)}</div><label>Arrondi général · {settings.theme_radius || "26"} px<input type="range" min="8" max="44" value={settings.theme_radius || "26"} onChange={(e) => set("theme_radius",e.target.value)} /></label><div className="cms-theme-preview" style={{ background: settings.theme_soft, color: settings.theme_ink, borderRadius: `${settings.theme_radius || 26}px` }}><span style={{ background: settings.theme_moss_dark }}>Bouton</span><strong>Aperçu Ichigo Ichie</strong><small>Les couleurs sont appliquées au site après enregistrement.</small></div></>)}

      {panel("seo", "SEO", "Titre et description affichés par les moteurs de recherche", <>{text("seo_title", "Titre SEO")}{area("seo_description", "Description SEO", 3)}</>)}

      {panel("logistics", "Réglages techniques boutique", "Poids d’emballage et paramètres de vente", <div className="form-grid">{text("shipping_packaging_weight_g", "Poids emballage d’expédition (g)")}{text("free_shipping_threshold", "Seuil indicatif livraison offerte (€)")}</div>)}

        </main>
      </div>

      {active && (hasUnsavedChanges || savingCms || savedFlash) && <div className={`cms-sticky-save-v229 ${savedFlash && !hasUnsavedChanges ? "is-saved" : "is-dirty"}`} role="status" aria-live="polite">
        <div className="cms-sticky-save-copy-v229"><span className="cms-save-state-dot-v229" aria-hidden="true"></span><div><strong>{savingCms ? "Enregistrement en cours…" : savedFlash && !hasUnsavedChanges ? "Site enregistré" : "Modifications non enregistrées"}</strong><small>{savingCms ? "Mise à jour du site…" : savedFlash && !hasUnsavedChanges ? "Les autres onglets ont été mis à jour." : "Vous pouvez continuer à modifier puis enregistrer une seule fois."}</small></div></div>
        <div className="cms-sticky-save-actions-v229">{hasUnsavedChanges && !savingCms && <button type="button" className="button ghost" onClick={discardChanges}>Annuler</button>}<button type="submit" className="button primary" disabled={!hasUnsavedChanges || savingCms}>{savingCms ? "Enregistrement…" : savedFlash && !hasUnsavedChanges ? "Enregistré ✓" : "Enregistrer"}</button></div>
      </div>}
    </form>
  </div>;
}
type ShippingMethodRow = {
  id: string;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  active: boolean;
  countries: string[];
  free_threshold: number | null;
  sort_order: number;
};

type ShippingRateRow = {
  id: string;
  method_id: string;
  max_weight_g: number;
  price: number;
  sort_order: number;
};

function ShippingRatesAdmin({ supabase }: { supabase: NonNullable<ReturnType<typeof createBrowserSupabase>> }) {
  const [methods, setMethods] = useState<ShippingMethodRow[]>([]);
  const [rates, setRates] = useState<ShippingRateRow[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const [{ data: methodRows, error: methodError }, { data: rateRows, error: rateError }] = await Promise.all([
      supabase.from("shipping_methods").select("*").order("sort_order"),
      supabase.from("shipping_rate_bands").select("*").order("method_id").order("max_weight_g"),
    ]);
    if (methodError || rateError) return setNote((methodError || rateError)?.message ?? "Chargement impossible.");
    setMethods((methodRows ?? []) as ShippingMethodRow[]);
    setRates((rateRows ?? []) as ShippingRateRow[]);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => { cancelled = true; };
  }, [load]);

  async function saveMethod(method: ShippingMethodRow) {
    const { error } = await supabase.from("shipping_methods").update({
      name_fr: method.name_fr,
      name_en: method.name_en,
      description_fr: method.description_fr,
      description_en: method.description_en,
      active: method.active,
      countries: method.countries?.length ? method.countries : ["FR"],
      free_threshold: method.free_threshold == null || Number.isNaN(Number(method.free_threshold)) ? null : Number(method.free_threshold),
      sort_order: Number(method.sort_order),
    }).eq("id", method.id);
    setNote(error ? error.message : "Mode de livraison enregistré ✓");
    if (!error) await load();
  }

  async function addMethod() {
    const id = `shipping-${Date.now()}`;
    const { error } = await supabase.from("shipping_methods").insert({
      id,
      name_fr: "Nouveau mode",
      name_en: "New shipping method",
      description_fr: "",
      description_en: "",
      active: false,
      countries: ["FR"],
      free_threshold: null,
      sort_order: methods.length + 1,
    });
    setNote(error ? error.message : "Mode ajouté ✓");
    if (!error) await load();
  }

  async function deleteMethod(method: ShippingMethodRow) {
    const methodRates = rates.filter((rate) => rate.method_id === method.id);
    const label = method.name_fr?.trim() || method.name_en?.trim() || "ce mode";
    const activeWarning = method.active
      ? "\n\nAttention : ce mode est actuellement ACTIF. Il disparaîtra immédiatement du checkout."
      : "";
    const rateWarning = methodRates.length
      ? `\n\n${methodRates.length} tranche${methodRates.length > 1 ? "s" : ""} de poids associée${methodRates.length > 1 ? "s" : ""} sera${methodRates.length > 1 ? "ont" : ""} également supprimée${methodRates.length > 1 ? "s" : ""}.`
      : "";

    if (!window.confirm(`Supprimer définitivement « ${label} » ?${activeWarning}${rateWarning}`)) return;

    setNote("Suppression du mode de livraison…");

    if (methodRates.length) {
      const { error: rateError } = await supabase
        .from("shipping_rate_bands")
        .delete()
        .eq("method_id", method.id);
      if (rateError) {
        setNote(rateError.message);
        return;
      }
    }

    const { error } = await supabase.from("shipping_methods").delete().eq("id", method.id);
    setNote(error ? error.message : "Mode de livraison supprimé ✓");
    if (!error) await load();
  }

  async function addRate(methodId: string) {
    const methodRates = rates.filter((rate) => rate.method_id === methodId);
    const lastWeight = Math.max(0, ...methodRates.map((rate) => Number(rate.max_weight_g)));
    const { error } = await supabase.from("shipping_rate_bands").insert({
      method_id: methodId,
      max_weight_g: lastWeight ? lastWeight + 1000 : 500,
      price: 0,
      sort_order: methodRates.length + 1,
    });
    setNote(error ? error.message : "Tranche ajoutée ✓");
    if (!error) await load();
  }

  async function saveRate(rate: ShippingRateRow) {
    const { error } = await supabase.from("shipping_rate_bands").update({
      max_weight_g: Number(rate.max_weight_g),
      price: Number(rate.price),
      sort_order: Number(rate.sort_order),
    }).eq("id", rate.id);
    setNote(error ? error.message : "Tarif enregistré ✓");
    if (!error) await load();
  }

  async function deleteRate(id: string) {
    if (!window.confirm("Supprimer cette tranche de poids ?")) return;
    const { error } = await supabase.from("shipping_rate_bands").delete().eq("id", id);
    setNote(error ? error.message : "Tarif supprimé ✓");
    if (!error) await load();
  }

  return <section className="shipping-admin settings-admin">
    <div className="section-inline"><div><h2>Livraison & tarifs</h2><p className="muted">Le serveur utilise le poids brut de chaque article + le poids d’emballage, puis choisit automatiquement la première tranche compatible.</p></div><button type="button" onClick={addMethod}>+ Mode</button></div>
    {note && <p className={note.includes("✓") ? "save-message success" : "save-message"}>{note}</p>}
    {methods.map((method, methodIndex) => <article className="shipping-admin-card" key={method.id}>
      <div className="shipping-admin-method-grid">
        <label>Nom FR<input value={method.name_fr} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, name_fr: e.target.value } : row))} /></label>
        <label>Nom EN<input value={method.name_en} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, name_en: e.target.value } : row))} /></label>
        <label>Livraison offerte dès (€)<input type="number" min="0" step="0.01" value={method.free_threshold ?? ""} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, free_threshold: e.target.value === "" ? null : Number(e.target.value) } : row))} /></label>
        <label>Ordre<input type="number" min="0" value={method.sort_order} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, sort_order: Number(e.target.value) } : row))} /></label>
        <label className="check-label"><input type="checkbox" checked={method.active} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, active: e.target.checked } : row))} /> Actif</label>
      </div>
      <div className="form-grid"><label>Description FR<input value={method.description_fr ?? ""} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, description_fr: e.target.value } : row))} /></label><label>Description EN<input value={method.description_en ?? ""} onChange={(e) => setMethods((current) => current.map((row, i) => i === methodIndex ? { ...row, description_en: e.target.value } : row))} /></label></div>
      <div className="shipping-admin-actions"><button type="button" onClick={() => saveMethod(method)}>Enregistrer le mode</button><button type="button" onClick={() => addRate(method.id)}>+ Tranche de poids</button><button type="button" className="shipping-method-delete" onClick={() => deleteMethod(method)}>Supprimer le mode</button></div>
      <div className="shipping-rate-head"><span>Jusqu’à (g)</span><span>Prix (€)</span><span>Ordre</span><span></span></div>
      <div className="shipping-rate-list">{rates.filter((rate) => rate.method_id === method.id).map((rate) => <ShippingRateEditor key={rate.id} rate={rate} onChange={(next) => setRates((current) => current.map((row) => row.id === next.id ? next : row))} onSave={saveRate} onDelete={deleteRate} />)}</div>
    </article>)}
  </section>;
}

function ShippingRateEditor({ rate, onChange, onSave, onDelete }: { rate: ShippingRateRow; onChange: (next: ShippingRateRow) => void; onSave: (rate: ShippingRateRow) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  return <div className="shipping-rate-row"><input type="number" min="1" value={rate.max_weight_g} onChange={(e) => onChange({ ...rate, max_weight_g: Number(e.target.value) })} /><input type="number" min="0" step="0.01" value={rate.price} onChange={(e) => onChange({ ...rate, price: Number(e.target.value) })} /><input type="number" min="0" value={rate.sort_order} onChange={(e) => onChange({ ...rate, sort_order: Number(e.target.value) })} /><div><button type="button" onClick={() => onSave(rate)}>Sauver</button><button type="button" className="text-danger" onClick={() => onDelete(rate.id)}>×</button></div></div>;
}

