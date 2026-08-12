"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Check = { id: string; label: string; status: "ok" | "warning" | "error"; detail: string; blocker?: boolean };
type CommerceHealth = {
  summary: {
    reservationIssueCount: number;
    stockReservationLeaks: number;
    promoReservationLeaks: number;
    promoMismatchCount: number;
    outOfStock: number;
    lowStock: number;
  };
  reservationIssues: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    stockReserved: boolean;
    promoReserved: boolean;
    stockLeak: boolean;
    promoLeak: boolean;
    ageMinutes: number;
    reason: string;
    recoveryAction: "release_order_reservations" | "commit_paid_promo" | null;
    recoveryLabel: string | null;
  }>;
  promoMismatches: Array<{
    id: string;
    code: string;
    reservedCount: number;
    orderReservations: number;
  }>;
  stockAlerts: Array<{
    id: string;
    kind: "product" | "variant";
    name: string;
    productName: string | null;
    sku: string | null;
    stock: number;
    severity: "out" | "low";
  }>;
  generatedAt: string;
};
type Health = {
  environment: "test" | "live";
  origin: string;
  checks: Check[];
  dataCounts: { test: number; live: number; legacy: number; archivedTest: number };
  commerceHealth: CommerceHealth | null;
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
  const [recoveryKey, setRecoveryKey] = useState("");

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

  async function commerceRecovery(
    action: "release_order_reservations" | "commit_paid_promo" | "sync_promo_counter",
    targetId: string,
    label: string,
  ) {
    const confirmation =
      action === "release_order_reservations"
        ? "LIBERER"
        : action === "commit_paid_promo"
          ? "FINALISER PROMO"
          : "SYNC PROMO";
    const question =
      action === "release_order_reservations"
        ? `Libérer les réservations de ${label} ? Cette action ne sera acceptée que si le paiement est réellement expiré/échoué.`
        : action === "commit_paid_promo"
          ? `Finaliser le code promo de ${label} comme utilisé ? Cette action est réservée aux paiements déjà traités.`
          : `Synchroniser le compteur de réservations du code ${label} avec les commandes réellement réservées ?`;

    if (!window.confirm(question)) return;

    const key = `${action}:${targetId}`;
    setRecoveryKey(key);
    setMessage("");

    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/commerce-recovery", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "sync_promo_counter"
            ? { promoId: targetId }
            : { orderId: targetId }),
          confirmation,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.changed === true) {
          await refresh();
          await onOrdersChanged?.();
        }
        throw new Error(data.error || "Récupération impossible.");
      }

      setMessage(data.message || "Récupération terminée ✓");
      await refresh();
      await onOrdersChanged?.();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Récupération impossible.",
      );
    } finally {
      setRecoveryKey("");
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

      {health.commerceHealth && (
        <section className="commerce-health-v375">
          <div className="production-section-title-v246 commerce-health-head-v375">
            <div>
              <p className="eyebrow">COMMERCE</p>
              <h3>Stock & réservations</h3>
              <p className="muted">Diagnostic en lecture seule ; les actions de récupération ci-dessous exigent une confirmation explicite et sont revalidées côté serveur avant toute modification.</p>
            </div>
            <span>
              {health.commerceHealth.summary.reservationIssueCount ||
              health.commerceHealth.summary.promoMismatchCount
                ? "À vérifier"
                : "Réservations saines"}
            </span>
          </div>

          <div className="commerce-health-kpis-v375">
            <div className={health.commerceHealth.summary.reservationIssueCount ? "danger" : ""}>
              <strong>{health.commerceHealth.summary.reservationIssueCount}</strong>
              <span>Réservations à vérifier</span>
            </div>
            <div className={health.commerceHealth.summary.stockReservationLeaks ? "danger" : ""}>
              <strong>{health.commerceHealth.summary.stockReservationLeaks}</strong>
              <span>Stock encore réservé</span>
            </div>
            <div className={health.commerceHealth.summary.promoMismatchCount ? "danger" : ""}>
              <strong>{health.commerceHealth.summary.promoMismatchCount}</strong>
              <span>Compteurs promo incohérents</span>
            </div>
            <div className={health.commerceHealth.summary.outOfStock ? "warning" : ""}>
              <strong>{health.commerceHealth.summary.outOfStock}</strong>
              <span>Ruptures</span>
            </div>
            <div className={health.commerceHealth.summary.lowStock ? "warning" : ""}>
              <strong>{health.commerceHealth.summary.lowStock}</strong>
              <span>Stocks faibles ≤ 3</span>
            </div>
          </div>

          {!health.commerceHealth.summary.reservationIssueCount &&
          !health.commerceHealth.summary.promoMismatchCount ? (
            <div className="commerce-health-ok-v375">
              <strong>Réservations cohérentes ✓</strong>
              <span>Les commandes expirées/annulées ne conservent pas de réservation détectable et les compteurs promo correspondent aux commandes réservées.</span>
            </div>
          ) : null}

          {health.commerceHealth.reservationIssues.length > 0 && (
            <div className="commerce-health-block-v375">
              <div className="commerce-health-block-title-v375">
                <strong>Commandes à vérifier</strong>
                <small>La page ne corrige rien automatiquement.</small>
              </div>
              <div className="commerce-health-rows-v375">
                {health.commerceHealth.reservationIssues.map((issue) => (
                  <article key={issue.id}>
                    <div>
                      <strong>{issue.orderNumber}</strong>
                      <small>{issue.reason}</small>
                    </div>
                    <div className="commerce-health-actions-v376">
                      <div className="commerce-health-tags-v375">
                        {issue.stockLeak && <span className="danger">STOCK</span>}
                        {issue.promoLeak && <span className="danger">PROMO</span>}
                        <span>{issue.paymentStatus || issue.status}</span>
                        <span>{issue.ageMinutes} min</span>
                      </div>
                      {issue.recoveryAction && issue.recoveryLabel && (
                        <button
                          type="button"
                          className="button ghost small commerce-recovery-button-v376"
                          disabled={Boolean(recoveryKey)}
                          onClick={() =>
                            commerceRecovery(
                              issue.recoveryAction!,
                              issue.id,
                              issue.orderNumber,
                            )
                          }
                        >
                          {recoveryKey === `${issue.recoveryAction}:${issue.id}`
                            ? "Vérification…"
                            : issue.recoveryLabel}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {health.commerceHealth.promoMismatches.length > 0 && (
            <div className="commerce-health-block-v375">
              <div className="commerce-health-block-title-v375">
                <strong>Compteurs de codes promo</strong>
                <small>Le compteur SQL doit correspondre aux commandes réellement réservées.</small>
              </div>
              <div className="commerce-health-rows-v375">
                {health.commerceHealth.promoMismatches.map((promo) => (
                  <article key={promo.id}>
                    <div>
                      <strong>{promo.code}</strong>
                      <small>Compteur promo : {promo.reservedCount} · commandes réservées : {promo.orderReservations}</small>
                    </div>
                    <div className="commerce-health-actions-v376">
                      <span className="commerce-health-mismatch-v375">Écart {promo.reservedCount - promo.orderReservations}</span>
                      <button
                        type="button"
                        className="button ghost small commerce-recovery-button-v376"
                        disabled={Boolean(recoveryKey)}
                        onClick={() =>
                          commerceRecovery("sync_promo_counter", promo.id, promo.code)
                        }
                      >
                        {recoveryKey === `sync_promo_counter:${promo.id}`
                          ? "Vérification…"
                          : "Synchroniser"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {health.commerceHealth.stockAlerts.length > 0 && (
            <div className="commerce-health-block-v375">
              <div className="commerce-health-block-title-v375">
                <strong>Alertes stock Boutique</strong>
                <small>Produits actifs sans variante + variantes actives.</small>
              </div>
              <div className="commerce-stock-grid-v375">
                {health.commerceHealth.stockAlerts.map((alert) => (
                  <article key={`${alert.kind}-${alert.id}`} className={alert.severity}>
                    <div>
                      <strong>{alert.productName ? `${alert.productName} · ${alert.name}` : alert.name}</strong>
                      <small>{alert.sku ? `SKU ${alert.sku}` : alert.kind === "variant" ? "Variante" : "Produit"}</small>
                    </div>
                    <span>{alert.stock}</span>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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
