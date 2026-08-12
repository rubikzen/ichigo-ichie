"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Category } from "@/lib/types";
import { siteSettingDefaults } from "@/lib/settings";
import { PromotionsAdmin } from "./PromotionsAdmin";
import { InvoiceSettingsAdmin } from "./InvoiceSettingsAdmin";
import { ProductionAdmin } from "./ProductionAdmin";
import { AdminMessages, type AdminContactMessage } from "./admin/AdminMessages";
import { CategoryAdmin } from "./admin/AdminCatalogEditors";
import { SettingsAdmin } from "./admin/AdminSettings";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminCatalog } from "./admin/AdminCatalog";

type Tab = "products" | "categories" | "orders" | "promos" | "messages" | "invoices" | "settings" | "system";



export function AdminDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("orders");
  const [orderPendingCount, setOrderPendingCount] = useState(0);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contactMessages, setContactMessages] = useState<AdminContactMessage[]>([]);
  const [contactFilter, setContactFilter] = useState<"new" | "all" | "archived">("new");
  const [contactSearch, setContactSearch] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({ ...siteSettingDefaults });
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    async function init() {
      if (!supabase) { setReady(true); return; }
      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) return router.replace("/admin/login");
      const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userResult.user.id).maybeSingle();
      if (!admin) { await supabase.auth.signOut(); return router.replace("/admin/login"); }
      await Promise.all([loadCategories(), loadMessages(), loadSettings()]);
      setReady(true);
    }
    init();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

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
  async function logout() { if (supabase) await supabase.auth.signOut(); router.replace("/admin/login"); }

  if (!ready) return <section className="admin-shell"><div className="loading-card">Chargement de l’administration…</div></section>;
  if (!supabase) return <section className="admin-shell"><div className="setup-warning"><h1>Supabase à connecter</h1><p>Le code est prêt. Ajoutez les clés dans <code>.env.local</code> et exécutez <code>supabase/schema.sql</code>.</p></div></section>;

  const labels: Record<Tab, string> = { products: "Catalogue", categories: "Catégories", orders: "Commandes", promos: "Promotions", messages: "Messages", invoices: "Facturation", settings: "Réglages", system: "Système" };
  const newContactCount = contactMessages.filter((item) => item.status === "new").length;

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

    {tab === "products" && (
      <AdminCatalog
        supabase={supabase}
        categories={categories}
      />
    )}
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
