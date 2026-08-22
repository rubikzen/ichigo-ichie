"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Category } from "@/lib/types";
import { siteSettingDefaults } from "@/lib/settings";
import { PromotionsAdmin } from "./PromotionsAdmin";
import { InvoiceSettingsAdmin } from "./InvoiceSettingsAdmin";
import { ProductionAdmin } from "./ProductionAdmin";
import {
  AdminMessages,
  type AdminContactMessage,
} from "./admin/AdminMessages";
import { CategoryAdmin } from "./admin/AdminCatalogEditors";
import { SettingsAdmin } from "./admin/AdminSettings";
import { AdminOrders } from "./admin/AdminOrders";
import { AdminCatalog } from "./admin/AdminCatalog";
import {
  AdminToday,
  type AdminArea,
  type AdminNavigate,
} from "./admin/AdminToday";
import {
  AdminPilotage,
  type PilotageSection,
} from "./admin/AdminPilotage";
import { AdminStockHub } from "./admin/AdminStockHub";

type OrdersSection = "orders" | "invoices";
type CatalogSection = "products" | "categories" | "stock" | "promos";
type SiteSection = "settings" | "messages";

const AREA_LABELS: Record<AdminArea, string> = {
  today: "Aujourd’hui",
  orders: "Commandes",
  catalog: "Catalogue",
  pilotage: "Pilotage",
  site: "Site",
  system: "Système",
};

function SecondaryNav({
  label,
  items,
  active,
  onChange,
}: {
  label: string;
  items: Array<{ id: string; label: string; badge?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="admin-secondary-nav-v476" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.badge ? <span>{item.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [ready, setReady] = useState(false);

  const [area, setArea] = useState<AdminArea>("today");
  const [ordersSection, setOrdersSection] =
    useState<OrdersSection>("orders");
  const [catalogSection, setCatalogSection] =
    useState<CatalogSection>("products");
  const [pilotageSection, setPilotageSection] =
    useState<PilotageSection>("overview");
  const [siteSection, setSiteSection] =
    useState<SiteSection>("settings");

  const [orderPendingCount, setOrderPendingCount] = useState(0);
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contactMessages, setContactMessages] = useState<
    AdminContactMessage[]
  >([]);
  const [contactFilter, setContactFilter] =
    useState<"new" | "all" | "archived">("new");
  const [contactSearch, setContactSearch] = useState("");
  const [settings, setSettings] = useState<Record<string, string>>({
    ...siteSettingDefaults,
  });
  const [settingsDirty, setSettingsDirty] = useState(false);

  useEffect(() => {
    async function init() {
      if (!supabase) {
        setReady(true);
        return;
      }

      const { data: userResult } = await supabase.auth.getUser();
      if (!userResult.user) {
        router.replace("/admin/login");
        return;
      }

      const { data: admin } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userResult.user.id)
        .maybeSingle();

      if (!admin) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      await Promise.all([loadCategories(), loadMessages(), loadSettings()]);
      setReady(true);
    }

    void init();
  }, [supabase]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCategories() {
    if (!supabase) return;
    const { data } = await supabase
      .from("categories")
      .select("*")
      .order("kind")
      .order("sort_order");
    setCategories((data ?? []) as Category[]);
  }

  async function loadMessages() {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.warn("Contact messages unavailable", error.message);
      setContactMessages([]);
      return;
    }

    setContactMessages((data ?? []) as AdminContactMessage[]);
  }

  async function updateContactStatus(
    id: string,
    status: AdminContactMessage["status"],
  ) {
    if (!supabase) return;
    const { error } = await supabase
      .from("contact_messages")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      window.alert(error.message);
      return;
    }

    await loadMessages();
  }

  async function loadSettings() {
    if (!supabase) return;
    const { data } = await supabase
      .from("site_settings")
      .select("key,value");
    const values = Object.fromEntries(
      (data ?? []).map((row) => [
        row.key,
        typeof row.value === "string"
          ? row.value
          : String(row.value ?? ""),
      ]),
    );
    setSettings({ ...siteSettingDefaults, ...values });
  }

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace("/admin/login");
  }

  const navigate: AdminNavigate = (nextArea, section) => {
    setArea(nextArea);

    if (nextArea === "orders" && section) {
      setOrdersSection(section as OrdersSection);
    }
    if (nextArea === "catalog" && section) {
      setCatalogSection(section as CatalogSection);
    }
    if (nextArea === "pilotage" && section) {
      setPilotageSection(section as PilotageSection);
    }
    if (nextArea === "site" && section) {
      setSiteSection(section as SiteSection);
    }
  };

  if (!ready) {
    return (
      <section className="admin-shell">
        <div className="loading-card">Chargement de l’administration…</div>
      </section>
    );
  }

  if (!supabase) {
    return (
      <section className="admin-shell">
        <div className="setup-warning">
          <h1>Supabase à connecter</h1>
          <p>
            Le code est prêt. Ajoutez les clés dans <code>.env.local</code> et
            exécutez <code>supabase/schema.sql</code>.
          </p>
        </div>
      </section>
    );
  }

  const newContactCount = contactMessages.filter(
    (item) => item.status === "new",
  ).length;

  const areaBadges: Partial<Record<AdminArea, number>> = {
    orders: orderPendingCount,
    site: newContactCount,
  };

  return (
    <section className="admin-shell admin-shell-v476">
      <header className="admin-top">
        <div>
          <p className="eyebrow">ICHIGO ICHIE</p>
          <h1>Administration</h1>
        </div>
        <div>
          <a className="button ghost small" href="/" target="_blank">
            Voir le site ↗
          </a>
          <button className="button ghost small" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>

      <nav
        className="admin-primary-nav-v476"
        aria-label="Espaces de l’administration"
      >
        {(
          [
            "today",
            "orders",
            "catalog",
            "pilotage",
            "site",
            "system",
          ] as AdminArea[]
        ).map((name) => (
          <button
            key={name}
            type="button"
            className={area === name ? "active" : ""}
            aria-current={area === name ? "page" : undefined}
            onClick={() => navigate(name)}
          >
            <strong>{AREA_LABELS[name]}</strong>
            {areaBadges[name] ? <span>{areaBadges[name]}</span> : null}
            {name === "site" && settingsDirty ? (
              <i
                className="cms-dirty-tab-dot-v229"
                title="Modifications non enregistrées"
                aria-label="Modifications non enregistrées"
              >
                •
              </i>
            ) : null}
          </button>
        ))}
      </nav>

      {area === "today" && (
        <AdminToday
          supabase={supabase}
          newContactCount={newContactCount}
          onNavigate={navigate}
          onOrderAttentionCount={setOrderPendingCount}
        />
      )}

      {area === "orders" && (
        <>
          <SecondaryNav
            label="Rubriques des commandes"
            active={ordersSection}
            onChange={(value) =>
              setOrdersSection(value as OrdersSection)
            }
            items={[
              {
                id: "orders",
                label: "Commandes",
                badge: orderPendingCount,
              },
              { id: "invoices", label: "Facturation" },
            ]}
          />

          {ordersSection === "orders" && (
            <AdminOrders
              supabase={supabase}
              refreshKey={ordersRefreshKey}
              onPendingCountChange={setOrderPendingCount}
            />
          )}

          {ordersSection === "invoices" && (
            <InvoiceSettingsAdmin supabase={supabase} />
          )}
        </>
      )}

      {area === "catalog" && (
        <>
          <SecondaryNav
            label="Rubriques du catalogue"
            active={catalogSection}
            onChange={(value) =>
              setCatalogSection(value as CatalogSection)
            }
            items={[
              { id: "products", label: "Produits" },
              { id: "categories", label: "Catégories" },
              { id: "stock", label: "Stock & réappro" },
              { id: "promos", label: "Promotions" },
            ]}
          />

          {catalogSection === "products" && (
            <AdminCatalog
              supabase={supabase}
              categories={categories}
            />
          )}

          {catalogSection === "categories" && (
            <CategoryAdmin
              categories={categories}
              supabase={supabase}
              reload={loadCategories}
            />
          )}

          {catalogSection === "stock" && (
            <AdminStockHub supabase={supabase} />
          )}

          {catalogSection === "promos" && (
            <PromotionsAdmin supabase={supabase} />
          )}
        </>
      )}

      {area === "pilotage" && (
        <AdminPilotage
          supabase={supabase}
          section={pilotageSection}
          onSectionChange={setPilotageSection}
          onNavigate={navigate}
        />
      )}

      {area === "site" && (
        <>
          <SecondaryNav
            label="Rubriques du site"
            active={siteSection}
            onChange={(value) =>
              setSiteSection(value as SiteSection)
            }
            items={[
              { id: "settings", label: "Réglages du site" },
              {
                id: "messages",
                label: "Messages",
                badge: newContactCount,
              },
            ]}
          />

          {siteSection === "messages" && (
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
        </>
      )}

      {area === "system" && (
        <ProductionAdmin
          supabase={supabase}
          onOrdersChanged={() =>
            setOrdersRefreshKey((current) => current + 1)
          }
        />
      )}

      <div
        className={
          area === "site" && siteSection === "settings"
            ? "admin-settings-host-v229 is-active"
            : "admin-settings-host-v229"
        }
      >
        <SettingsAdmin
          settings={settings}
          setSettings={setSettings}
          supabase={supabase}
          reload={loadSettings}
          active={area === "site" && siteSection === "settings"}
          onDirtyChange={setSettingsDirty}
        />
      </div>
    </section>
  );
}
