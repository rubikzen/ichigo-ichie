"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { SafeImage } from "@/components/SafeImage";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type AccessState = "checking" | "signed_out" | "ready";
type ScanState =
  | "ready"
  | "completed"
  | "not_ready"
  | "payment_required"
  | "unavailable"
  | "invalid"
  | "refresh_required";

type PickupItem = {
  name: string;
  quantity: number;
  choices: string[];
};

type PickupWorkflowStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed";

type ScanResult = {
  orderNumber?: string;
  state: ScanState;
  workflowStatus?: PickupWorkflowStatus;
  canPrepare?: boolean;
  canMarkReady?: boolean;
  canHandoff?: boolean;
  alreadyCompleted?: boolean;
  customerName?: string;
  items?: PickupItem[];
};

function stateCopy(state: ScanState, workflowStatus?: PickupWorkflowStatus) {
  if (state === "ready") {
    return {
      title: "Prête à remettre",
      description: "Le paiement est confirmé. Vous pouvez remettre la commande.",
      tone: "ready",
    };
  }
  if (state === "completed") {
    return {
      title: "Déjà remise",
      description: "Cette commande a déjà été remise au client.",
      tone: "done",
    };
  }
  if (state === "payment_required") {
    return {
      title: "Paiement à confirmer",
      description: "Confirmez le paiement en caisse avant la remise.",
      tone: "waiting",
    };
  }
  if (state === "not_ready" && workflowStatus === "pending") {
    return {
      title: "À préparer",
      description: "Le paiement est confirmé. Commencez la préparation.",
      tone: "waiting",
    };
  }
  if (state === "not_ready" && workflowStatus === "preparing") {
    return {
      title: "En préparation",
      description: "Quand tout est prêt, prévenez le client.",
      tone: "waiting",
    };
  }
  if (state === "not_ready") {
    return {
      title: "Pas encore prête",
      description: "La commande doit avancer dans la préparation.",
      tone: "waiting",
    };
  }
  if (state === "unavailable") {
    return {
      title: "Commande indisponible",
      description: "Cette commande est annulée ou remboursée.",
      tone: "blocked",
    };
  }
  if (state === "refresh_required") {
    return {
      title: "État modifié",
      description: "Scannez de nouveau le QR avant de continuer.",
      tone: "waiting",
    };
  }
  return {
    title: "QR invalide",
    description: "Ce QR ne correspond pas à un retrait Ichigo Ichie.",
    tone: "blocked",
  };
}

export function PickupScanner() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [authError, setAuthError] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [activeQr, setActiveQr] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scanLockRef = useRef(false);
  const linkedPickupLoadedRef = useRef(false);

  async function accessToken() {
    if (!supabase) return "";
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || "";
  }

  async function staffFetch(path: string, init: RequestInit = {}) {
    const token = await accessToken();
    if (!token) throw Object.assign(new Error("Session expirée."), { status: 401 });

    const response = await fetch(path, {
      ...init,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers || {}),
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = Object.assign(
        new Error(String(data.error || "Action impossible.")),
        { status: response.status, data }
      );
      throw error;
    }
    return data;
  }

  async function verifyAccess() {
    try {
      await staffFetch("/api/pickup-staff/me");
      setAccessState("ready");
      setAuthError("");

      if (typeof window !== "undefined" && !linkedPickupLoadedRef.current) {
        const linkedPickup = new URL(window.location.href).searchParams.get("pickup");
        if (linkedPickup) {
          linkedPickupLoadedRef.current = true;
          await inspectQr(linkedPickup, true);
        }
      }
    } catch (error) {
      const status = Number((error as { status?: number })?.status || 0);
      if (status === 401 || status === 403) {
        await supabase?.auth.signOut();
        setAccessState("signed_out");
        setAuthError(
          status === 403
            ? "Ce compte n’a pas accès au scanner de retrait."
            : ""
        );
        return;
      }
      setAccessState("signed_out");
      setAuthError(
        error instanceof Error ? error.message : "Accès indisponible."
      );
    }
  }

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void verifyAccess();
    });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setAuthError("Supabase n’est pas configuré.");
      return;
    }

    setBusy(true);
    setAuthError("");
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    });

    if (error) {
      setBusy(false);
      setAuthError(error.message);
      return;
    }

    await verifyAccess();
    setBusy(false);
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setCameraActive(false);
  }

  async function inspectQr(rawQr: string, ignoreBusy = false) {
    const qr = rawQr.trim();
    if (!qr || (busy && !ignoreBusy)) return;

    stopCamera();
    setBusy(true);
    setScanError("");
    setActionNotice("");
    setScanResult(null);

    try {
      const data = await staffFetch("/api/pickup-staff/scan", {
        method: "POST",
        body: JSON.stringify({ qr }),
      });

      setActiveQr(qr);
      setScanResult({
        orderNumber: data.orderNumber,
        state: data.state,
        workflowStatus: data.workflowStatus,
        canPrepare: Boolean(data.canPrepare),
        canMarkReady: Boolean(data.canMarkReady),
        canHandoff: Boolean(data.canHandoff),
        customerName:
          typeof data.customerName === "string" ? data.customerName : undefined,
        items: Array.isArray(data.items) ? data.items : undefined,
      });
    } catch (error) {
      const data = (error as { data?: ScanResult })?.data;
      if (data?.state) {
        setActiveQr(qr);
        setScanResult(data);
      } else {
        setScanError(
          error instanceof Error ? error.message : "Scan impossible."
        );
      }
    } finally {
      setBusy(false);
      scanLockRef.current = false;
    }
  }

  async function startCamera() {
    if (!videoRef.current || cameraActive) return;

    setScanError("");
    setScanResult(null);
    setActiveQr("");
    scanLockRef.current = false;

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanAttempts: 300,
      delayBetweenScanSuccess: 1000,
    });

    try {
      setCameraActive(true);
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (!result || scanLockRef.current) return;
          scanLockRef.current = true;
          void inspectQr(result.getText());
        }
      );
      controlsRef.current = controls;
    } catch (error) {
      setCameraActive(false);
      setScanError(
        error instanceof Error
          ? error.message
          : "Impossible d’ouvrir la caméra."
      );
    }
  }

  async function manualScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await inspectQr(String(form.get("qr") || ""));
  }


  async function advancePickupWorkflow(target: "preparing" | "ready") {
    if (!activeQr || !scanResult || busy) return;
    setBusy(true);
    setScanError("");
    setActionNotice("");

    try {
      const data = await staffFetch("/api/pickup-staff/status", {
        method: "POST",
        body: JSON.stringify({ qr: activeQr, target }),
      });
      setScanResult((current) => current ? {
        ...current,
        state: data.state,
        workflowStatus: data.workflowStatus,
        canPrepare: Boolean(data.canPrepare),
        canMarkReady: Boolean(data.canMarkReady),
        canHandoff: Boolean(data.canHandoff),
      } : current);

      if (target === "preparing") {
        setActionNotice("Préparation démarrée.");
      } else if (data.pickupEmail === "sent" || data.pickupEmail === "already_sent") {
        setActionNotice("Commande prête · client prévenu par e-mail.");
      } else {
        setActionNotice("Commande prête · l’e-mail client doit être vérifié.");
      }
    } catch (error) {
      const data = (error as { data?: ScanResult })?.data;
      if (data?.state) setScanResult(data);
      setScanError(error instanceof Error ? error.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmHandoff() {
    if (!activeQr || !scanResult?.canHandoff || busy) return;

    setBusy(true);
    setScanError("");

    try {
      const data = await staffFetch("/api/pickup-staff/complete", {
        method: "POST",
        body: JSON.stringify({ qr: activeQr }),
      });

      setScanResult({
        orderNumber: data.orderNumber,
        state: "completed",
        workflowStatus: "completed",
        canPrepare: false,
        canMarkReady: false,
        canHandoff: false,
        alreadyCompleted: Boolean(data.alreadyCompleted),
        customerName: scanResult.customerName,
        items: scanResult.items,
      });
      if (data.pickupEmail === "failed" || data.pickupEmail === "email_not_configured") {
        setActionNotice("Remise confirmée · l’e-mail client doit être vérifié.");
      } else {
        setActionNotice("Remise confirmée.");
      }
    } catch (error) {
      const data = (error as { data?: ScanResult })?.data;
      if (data?.state) {
        setScanResult(data);
      }
      setScanError(
        error instanceof Error ? error.message : "Remise impossible."
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    stopCamera();
    await supabase?.auth.signOut();
    setScanResult(null);
    setActiveQr("");
    setAccessState("signed_out");
  }

  function resetScan() {
    stopCamera();
    setScanResult(null);
    setActiveQr("");
    setScanError("");
    setActionNotice("");
  }

  if (accessState === "checking") {
    return (
      <section className="pickup-staff-page-v444">
        <div className="pickup-staff-shell-v444 pickup-staff-loading-v444">
          Vérification de l’accès…
        </div>
      </section>
    );
  }

  if (accessState === "signed_out") {
    return (
      <section className="pickup-staff-page-v444">
        <div className="pickup-staff-login-v444">
          <SafeImage
            src="/brand-mark.svg"
            alt=""
            width={58}
            height={58}
            sizes="58px"
            priority
          />
          <p className="eyebrow">ICHIGO ICHIE · RETRAIT</p>
          <h1>Scanner boutique</h1>
          <p>
            Cet espace permet uniquement de préparer les retraits, prévenir le
            client quand la commande est prête et confirmer la remise.
          </p>

          <form onSubmit={login}>
            <label>
              E-mail
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
              />
            </label>
            <label>
              Mot de passe
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
            </label>
            {authError && <p className="form-error">{authError}</p>}
            <button
              type="submit"
              className="button primary full"
              disabled={busy}
            >
              {busy ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const copy = scanResult ? stateCopy(scanResult.state, scanResult.workflowStatus) : null;

  return (
    <section className="pickup-staff-page-v444">
      <div className="pickup-staff-shell-v444">
        <header className="pickup-staff-head-v444">
          <div>
            <p className="eyebrow">ICHIGO ICHIE · RETRAIT</p>
            <h1>Scanner</h1>
            <p>Aucune liste de commandes n’est accessible dans cet espace.</p>
          </div>
          <button
            type="button"
            className="button ghost small"
            onClick={logout}
          >
            Déconnexion
          </button>
        </header>

        <div className="pickup-camera-v444">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Caméra de scan QR"
          />
          {!cameraActive && !scanResult && (
            <button
              type="button"
              className="button primary pickup-camera-start-v444"
              onClick={startCamera}
              disabled={busy}
            >
              Ouvrir la caméra
            </button>
          )}
          {cameraActive && (
            <div className="pickup-camera-guide-v444" aria-hidden="true" />
          )}
        </div>

        {!scanResult && (
          <form
            className="pickup-manual-scan-v444"
            onSubmit={manualScan}
          >
            <label>
              Scanner USB / code QR
              <input
                type="text"
                name="qr"
                placeholder="Scannez ou collez le code"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              className="button ghost"
              disabled={busy}
            >
              Vérifier
            </button>
          </form>
        )}

        {scanError && <p className="pickup-staff-error-v444">{scanError}</p>}
        {actionNotice && <p className="pickup-staff-notice-v446">{actionNotice}</p>}

        {scanResult && copy && (
          <article className={`pickup-scan-result-v444 ${copy.tone}`}>
            <span className="pickup-scan-result-icon-v444" aria-hidden="true">
              {scanResult.state === "completed"
                ? "✓"
                : scanResult.state === "ready"
                  ? "→"
                  : "!"}
            </span>
            <div className="pickup-scan-result-copy-v444">
              <p className="eyebrow">COMMANDE</p>
              <strong>{scanResult.orderNumber || "—"}</strong>
              <h2>{copy.title}</h2>
              <p>{copy.description}</p>
            </div>

            {(scanResult.customerName || scanResult.items?.length) && (
              <div className="pickup-order-details-v445">
                {scanResult.customerName && (
                  <section className="pickup-order-customer-v445">
                    <span>CLIENT</span>
                    <strong>{scanResult.customerName}</strong>
                  </section>
                )}

                {Boolean(scanResult.items?.length) && (
                  <section className="pickup-order-items-v445">
                    <span>ARTICLES À REMETTRE</span>
                    <div className="pickup-order-items-list-v445">
                      {scanResult.items?.map((item, index) => (
                        <div
                          className="pickup-order-item-v445"
                          key={`${item.name}-${index}`}
                        >
                          <strong>
                            {item.quantity} × {item.name}
                          </strong>
                          {Boolean(item.choices?.length) && (
                            <small>{item.choices.join(" · ")}</small>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}


            {scanResult.canPrepare && (
              <button
                type="button"
                className="button primary pickup-workflow-action-v446"
                onClick={() => advancePickupWorkflow("preparing")}
                disabled={busy}
              >
                {busy ? "Mise à jour…" : "Commencer la préparation"}
              </button>
            )}

            {scanResult.canMarkReady && (
              <button
                type="button"
                className="button primary pickup-workflow-action-v446"
                onClick={() => advancePickupWorkflow("ready")}
                disabled={busy}
              >
                {busy ? "Mise à jour…" : "Marquer comme prête"}
              </button>
            )}

            {scanResult.canHandoff && (
              <button
                type="button"
                className="button primary pickup-confirm-handoff-v444"
                onClick={confirmHandoff}
                disabled={busy}
              >
                {busy ? "Confirmation…" : "Confirmer la remise"}
              </button>
            )}

            {!scanResult.canPrepare &&
              !scanResult.canMarkReady &&
              !scanResult.canHandoff && (
              <button
                type="button"
                className="button ghost"
                onClick={resetScan}
              >
                Scanner une autre commande
              </button>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
