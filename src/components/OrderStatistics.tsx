"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";

type StatsResponse = {
  period: { from: string; to: string };
  summary: {
    revenue: number;
    orderCount: number;
    averageOrder: number;
    discounts: number;
    shippingFees: number;
    refunded: number;
    shippingOrders: number;
    pickupOrders: number;
    promoOrders: number;
  };
  daily: Array<{ date: string; revenue: number; orders: number }>;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  topPromos: Array<{ code: string; orders: number; discount: number }>;
};

type StatsErrorPayload = {
  error?: string;
  code?: string;
  reference?: string;
  technical?: { stage?: string; message?: string; code?: string; details?: string; hint?: string };
};

function localStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function rangeFor(key: Exclude<RangeKey, "custom">) {
  const now = new Date();
  const today = localStart(now);
  if (key === "today") return { from: today, to: addDays(today, 1) };
  if (key === "7d") return { from: addDays(today, -6), to: addDays(today, 1) };
  if (key === "30d") return { from: addDays(today, -29), to: addDays(today, 1) };
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(today, 1) };
}

function inputDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function euro(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function dayLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="order-stat-card-v239"><span>{label}</span><strong>{value}</strong>{hint ? <small>{hint}</small> : null}</div>;
}

export function OrderStatistics({ supabase, refreshKey }: { supabase: SupabaseClient; refreshKey: string }) {
  const [range, setRange] = useState<RangeKey>("30d");
  const default30 = useMemo(() => rangeFor("30d"), []);
  const [customFrom, setCustomFrom] = useState(inputDate(default30.from));
  const [customTo, setCustomTo] = useState(inputDate(addDays(default30.to, -1)));
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorMeta, setErrorMeta] = useState<StatsErrorPayload | null>(null);
  const [open, setOpen] = useState(true);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | "">("");
  const [exportError, setExportError] = useState("");

  const activeDates = useMemo(() => {
    if (range !== "custom") return rangeFor(range);
    const from = new Date(`${customFrom}T00:00:00`);
    const toInclusive = new Date(`${customTo}T00:00:00`);
    return { from, to: addDays(toInclusive, 1) };
  }, [range, customFrom, customTo]);

  const load = useCallback(async () => {
    if (Number.isNaN(activeDates.from.getTime()) || Number.isNaN(activeDates.to.getTime()) || activeDates.from >= activeDates.to) {
      setError("Période invalide.");
      return;
    }
    setLoading(true);
    setError("");
    setErrorMeta(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session administrateur expirée.");
      const params = new URLSearchParams({ from: activeDates.from.toISOString(), to: activeDates.to.toISOString() });
      const response = await fetch(`/api/admin/order-stats?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json() as StatsResponse | StatsErrorPayload;
      if (!response.ok) {
        const failure = payload as StatsErrorPayload;
        setErrorMeta(failure);
        throw new Error(failure.error || "Statistiques indisponibles.");
      }
      setStats(payload as StatsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Statistiques indisponibles.");
    } finally {
      setLoading(false);
    }
  }, [activeDates.from, activeDates.to, supabase]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  const exportStats = useCallback(async (format: "csv" | "xlsx") => {
    setExporting(format);
    setExportError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session administrateur expirée.");
      const params = new URLSearchParams({
        from: activeDates.from.toISOString(),
        to: activeDates.to.toISOString(),
        format,
      });
      const response = await fetch(`/api/admin/order-stats/export?${params.toString()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Export impossible.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `ichigo-statistiques.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setExporting("");
    }
  }, [activeDates.from, activeDates.to, supabase]);

  const maxRevenue = Math.max(1, ...(stats?.daily.map((item) => item.revenue) ?? [1]));
  const totalFulfillment = Number(stats?.summary.shippingOrders || 0) + Number(stats?.summary.pickupOrders || 0);
  const shippingPct = totalFulfillment ? Math.round((Number(stats?.summary.shippingOrders || 0) / totalFulfillment) * 100) : 0;
  const pickupPct = totalFulfillment ? 100 - shippingPct : 0;

  return <section className="order-analytics-v239">
    <div className="order-analytics-head-v239">
      <div><p className="eyebrow">STATISTIQUES</p><h3>Pilotage Boutique</h3><p>Commandes Boutique payées uniquement. Les commandes à payer, annulées ou remboursées ne gonflent pas le chiffre d’affaires.</p></div>
      <div className="order-analytics-head-actions-v239">
        <details className="order-export-menu-v240">
          <summary className="button ghost small">Exporter ▾</summary>
          <div className="order-export-popover-v240">
            <button type="button" onClick={() => exportStats("xlsx")} disabled={Boolean(exporting)}><strong>{exporting === "xlsx" ? "Création…" : "Excel (.xlsx)"}</strong><small>Résumé · commandes · CA quotidien · produits · promos</small></button>
            <button type="button" onClick={() => exportStats("csv")} disabled={Boolean(exporting)}><strong>{exporting === "csv" ? "Création…" : "CSV (.csv)"}</strong><small>Liste des commandes payées, compatible Excel / Numbers</small></button>
          </div>
        </details>
        <button type="button" className="button ghost small" onClick={load} disabled={loading}>{loading ? "Calcul…" : "Actualiser"}</button>
        <button type="button" className="button ghost small" onClick={() => setOpen((value) => !value)}>{open ? "Masquer" : "Afficher"}</button>
      </div>
    </div>

    {open && <>
      <div className="order-range-v239" role="group" aria-label="Période des statistiques">
        {([["today", "Aujourd’hui"], ["7d", "7 jours"], ["30d", "30 jours"], ["month", "Ce mois"], ["custom", "Période"]] as Array<[RangeKey,string]>).map(([key,label]) => <button type="button" key={key} className={range === key ? "active" : ""} onClick={() => setRange(key)}>{label}</button>)}
        {range === "custom" && <div className="order-custom-range-v239"><label>Du<input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></label><span>→</span><label>Au<input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></label><button type="button" className="button primary small" onClick={load}>Appliquer</button></div>}
      </div>

      {exportError ? <div className="order-export-error-v240">{exportError}</div> : null}
      {error ? <div className="order-analytics-error-v239 order-analytics-error-v2392">
        <strong>{error}</strong>
        {errorMeta?.code ? <span>{errorMeta.code}{errorMeta.reference ? ` · ${errorMeta.reference}` : ""}</span> : null}
        {errorMeta?.technical ? <details><summary>Détail technique · local</summary><code>{[errorMeta.technical.stage, errorMeta.technical.code, errorMeta.technical.message, errorMeta.technical.details, errorMeta.technical.hint].filter(Boolean).join(" · ")}</code></details> : null}
      </div> : null}
      {!error && stats ? <>
        <div className="order-stats-grid-v239">
          <StatCard label="CA encaissé" value={euro(stats.summary.revenue)} hint="hors commandes remboursées" />
          <StatCard label="Commandes payées" value={String(stats.summary.orderCount)} />
          <StatCard label="Panier moyen" value={euro(stats.summary.averageOrder)} />
          <StatCard label="Remises" value={euro(stats.summary.discounts)} hint={`${stats.summary.promoOrders} commande${stats.summary.promoOrders > 1 ? "s" : ""} avec promo`} />
          <StatCard label="Frais de livraison" value={euro(stats.summary.shippingFees)} />
          <StatCard label="Remboursé" value={euro(stats.summary.refunded)} hint="commandes de la période" />
        </div>

        <div className="order-analytics-layout-v239">
          <article className="order-chart-card-v239">
            <div className="order-mini-title-v239"><div><strong>Évolution du CA</strong><small>{stats.summary.orderCount} commande{stats.summary.orderCount > 1 ? "s" : ""} payée{stats.summary.orderCount > 1 ? "s" : ""}</small></div><b>{euro(stats.summary.revenue)}</b></div>
            {stats.daily.length ? <div className="order-bars-v239" aria-label="Chiffre d’affaires par jour">{stats.daily.map((item) => <div className="order-bar-column-v239" key={item.date} title={`${dayLabel(item.date)} · ${euro(item.revenue)} · ${item.orders} commande(s)`}><div className="order-bar-track-v239"><i style={{ height: `${Math.max(item.revenue ? 7 : 0, Math.round((item.revenue / maxRevenue) * 100))}%` }}></i></div><span>{dayLabel(item.date)}</span></div>)}</div> : <div className="order-analytics-empty-v239">Aucune vente payée sur cette période.</div>}
          </article>

          <article className="order-side-stat-v239">
            <div className="order-mini-title-v239"><div><strong>Mode de remise</strong><small>Commandes payées</small></div></div>
            <div className="fulfillment-stat-v239"><div><span>Livraison</span><strong>{stats.summary.shippingOrders}</strong><small>{shippingPct} %</small></div><div><span>Retrait boutique</span><strong>{stats.summary.pickupOrders}</strong><small>{pickupPct} %</small></div></div>
            <div className="fulfillment-meter-v239"><i style={{ width: `${shippingPct}%` }}></i></div>
          </article>
        </div>

        <div className="order-rankings-v239">
          <article><div className="order-mini-title-v239"><div><strong>Top produits</strong><small>Quantités vendues</small></div></div>{stats.topProducts.length ? <ol>{stats.topProducts.map((item) => <li key={item.name}><span><strong>{item.name}</strong><small>{item.quantity} vendu{item.quantity > 1 ? "s" : ""}</small></span><b>{euro(item.revenue)}</b></li>)}</ol> : <div className="order-analytics-empty-v239">Pas encore de produit vendu.</div>}</article>
          <article><div className="order-mini-title-v239"><div><strong>Codes promo</strong><small>Impact sur la période</small></div></div>{stats.topPromos.length ? <ol>{stats.topPromos.map((item) => <li key={item.code}><span><strong>{item.code}</strong><small>{item.orders} utilisation{item.orders > 1 ? "s" : ""}</small></span><b>− {euro(item.discount)}</b></li>)}</ol> : <div className="order-analytics-empty-v239">Aucun code promo utilisé.</div>}</article>
        </div>
      </> : !error ? <div className="order-analytics-loading-v239">Calcul des statistiques…</div> : null}
    </>}
  </section>;
}
