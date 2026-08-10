"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Check = { id: string; label: string; status: "ok" | "warning" | "error"; detail: string; blocker?: boolean };
type Health = {
  environment: "test" | "live";
  origin: string;
  checks: Check[];
  dataCounts: { test: number; live: number; legacy: number; archivedTest: number };
  readyForLiveSwitch: boolean;
  productionReady: boolean;
  generatedAt: string;
};

export function ProductionAdmin({ supabase, onOrdersChanged }: { supabase: SupabaseClient; onOrdersChanged?: () => Promise<void> | void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);

  const authHeaders = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session administrateur expirée.");
    return { authorization: `Bearer ${token}` };
  }, [supabase]);

  const refresh = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/system-health", { headers, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Diagnostic impossible.");
      setHealth(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Diagnostic impossible.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function dataAction(action: "mark_legacy_test" | "archive_test" | "restore_test", required: string) {
    if (confirmation.trim().toUpperCase() !== required) {
      setMessage(`Tapez exactement « ${required} » pour confirmer.`);
      return;
    }
    setWorking(true); setMessage("");
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/system-data", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ action, confirmation }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Action impossible.");
      setMessage(data.message || "Action terminée ✓");
      setConfirmation("");
      await refresh();
      await onOrdersChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible.");
    } finally {
      setWorking(false);
    }
  }

  const blockers = health?.checks.filter((check) => check.blocker && check.status === "error") ?? [];

  return <div className="production-admin-v246">
    <div className="production-head-v246">
      <div><p className="eyebrow">PRODUCTION</p><h2>Santé du système</h2><p className="muted">Vérifiez paiement, base de données, e-mails, facturation et environnement avant la mise en ligne.</p></div>
      <button type="button" className="button ghost small" onClick={refresh} disabled={loading}>{loading ? "Vérification…" : "Actualiser"}</button>
    </div>

    {message && <div className={message.includes("✓") || message.includes("commande") ? "production-message-v246 success" : "production-message-v246"}>{message}</div>}

    {health && <>
      <div className={`production-mode-banner-v246 ${health.productionReady ? "ready" : health.environment === "live" ? "blocked" : "test"}`}>
        <div><span className="production-mode-dot-v246"></span><div><strong>{health.productionReady ? "Production prête" : health.environment === "live" ? "Mode LIVE · vérifications requises" : "Mode TEST"}</strong><p>{health.productionReady ? "Le site utilise HTTPS et les contrôles bloquants sont validés." : health.environment === "test" ? "Continuez les tests sans argent réel. Passez en LIVE uniquement après déploiement HTTPS." : `${blockers.length} point(s) bloquant(s) restent à corriger.`}</p></div></div>
        <span className="production-env-chip-v246">{health.environment.toUpperCase()}</span>
      </div>

      <div className="production-check-grid-v246">
        {health.checks.map((check) => <article key={check.id} className={`production-check-v246 ${check.status}`}>
          <span className="production-check-icon-v246">{check.status === "ok" ? "✓" : check.status === "warning" ? "!" : "×"}</span>
          <div><strong>{check.label}</strong><p>{check.detail}</p>{check.blocker && check.status === "error" && <small>Bloquant avant production</small>}</div>
        </article>)}
      </div>

      <section className="production-launch-v246">
        <div className="production-section-title-v246"><div><p className="eyebrow">MISE EN LIGNE</p><h3>Checklist finale</h3></div><span>{health.readyForLiveSwitch ? "Technique prête" : `${blockers.length} blocage(s)`}</span></div>
        <div className="production-launch-list-v246">
          <div><b>01</b><span><strong>Déployer sur le domaine HTTPS</strong><small>Vercel + domaine final, puis NEXT_PUBLIC_SITE_URL=https://…</small></span></div>
          <div><b>02</b><span><strong>Ajouter les variables LIVE</strong><small>pk_live + sk_live/rk_live dans l’environnement production uniquement.</small></span></div>
          <div><b>03</b><span><strong>Créer le webhook Stripe production</strong><small>/api/stripe/webhook avec son propre whsec_ live. Ne réutilisez pas le secret de Stripe CLI.</small></span></div>
          <div><b>04</b><span><strong>Autoriser le callback client</strong><small>Ajouter https://votre-domaine/compte/callback dans Supabase Auth.</small></span></div>
          <div><b>05</b><span><strong>Vérifier le domaine e-mail</strong><small>EMAIL_FROM doit utiliser un domaine validé dans Resend.</small></span></div>
          <div><b>06</b><span><strong>Faire une vraie commande de faible montant</strong><small>Payer, webhook, facture, e-mail, suivi, remboursement puis vérifier les statistiques.</small></span></div>
        </div>
      </section>

      <section className="production-data-v246">
        <div className="production-section-title-v246"><div><p className="eyebrow">DONNÉES</p><h3>Séparer les tests de la production</h3></div></div>
        <div className="production-counts-v246">
          <div><strong>{health.dataCounts.test}</strong><span>Tests actifs</span></div>
          <div><strong>{health.dataCounts.archivedTest}</strong><span>Tests archivés</span></div>
          <div><strong>{health.dataCounts.live}</strong><span>Commandes live</span></div>
          <div className={health.dataCounts.legacy ? "warning" : ""}><strong>{health.dataCounts.legacy}</strong><span>Anciennes non classées</span></div>
        </div>
        <div className="production-data-note-v246"><strong>Aucune suppression automatique.</strong><span>V2.46 archive les commandes test au lieu de les effacer. Les produits, catégories, réglages et clients ne sont jamais touchés.</span></div>
        <label className="production-confirm-v246"><span>Confirmation</span><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="MARQUER TEST / ARCHIVER TEST / RESTAURER TEST" /></label>
        <div className="production-data-actions-v246">
          <button type="button" className="button ghost small" disabled={working || !health.dataCounts.legacy} onClick={() => dataAction("mark_legacy_test", "MARQUER TEST")}>Classer les anciennes comme test</button>
          <button type="button" className="button danger small" disabled={working || !health.dataCounts.test} onClick={() => dataAction("archive_test", "ARCHIVER TEST")}>Archiver les commandes test</button>
          <button type="button" className="button ghost small" disabled={working || !health.dataCounts.archivedTest} onClick={() => dataAction("restore_test", "RESTAURER TEST")}>Restaurer les tests archivés</button>
        </div>
      </section>
    </>}
  </div>;
}
