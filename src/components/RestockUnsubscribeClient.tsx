"use client";

import Link from "next/link";
import { useState } from "react";

export function RestockUnsubscribeClient({
  subscriptionId,
  token,
  language,
}: {
  subscriptionId: string;
  token: string;
  language: "fr" | "en";
}) {
  const [state, setState] = useState<"idle" | "loading" | "cancelled" | "inactive" | "error">("idle");
  const [message, setMessage] = useState("");
  const fr = language === "fr";
  const validLink = Boolean(subscriptionId && token);

  async function cancelAlert() {
    if (!validLink || state === "loading") return;
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/restock/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscriptionId, token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (fr ? "Impossible de modifier cette alerte." : "Unable to update this alert."));
      setState(data.state === "cancelled" ? "cancelled" : "inactive");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : fr ? "Impossible de modifier cette alerte." : "Unable to update this alert.");
    }
  }

  return (
    <main className="restock-manage-page-v428">
      <section className="restock-manage-card-v428">
        <span className="restock-manage-kicker-v428">ICHIGO ICHIE</span>
        {!validLink ? (
          <>
            <h1>{fr ? "Lien d’alerte invalide" : "Invalid alert link"}</h1>
            <p>{fr ? "Ce lien est incomplet." : "This link is incomplete."}</p>
          </>
        ) : state === "cancelled" ? (
          <>
            <div className="restock-manage-check-v428" aria-hidden="true">✓</div>
            <h1>{fr ? "Alerte annulée" : "Alert cancelled"}</h1>
            <p>{fr ? "Vous ne recevrez pas d’e-mail pour cette alerte." : "You won't receive an email for this alert."}</p>
          </>
        ) : state === "inactive" ? (
          <>
            <div className="restock-manage-check-v428" aria-hidden="true">✓</div>
            <h1>{fr ? "Cette alerte n’est plus active" : "This alert is no longer active"}</h1>
            <p>{fr ? "Aucune autre action n’est nécessaire." : "No further action is required."}</p>
          </>
        ) : (
          <>
            <h1>{fr ? "Gérer votre alerte" : "Manage your alert"}</h1>
            <p>{fr ? "Votre alerte reste active tant que vous ne l’annulez pas ou qu’elle n’a pas été envoyée." : "Your alert stays active until you cancel it or the notification has been sent."}</p>
            <div className="restock-manage-actions-v428">
              <button type="button" className="button danger" disabled={state === "loading"} onClick={() => void cancelAlert()}>
                {state === "loading" ? (fr ? "Annulation…" : "Cancelling…") : (fr ? "Annuler cette alerte" : "Cancel this alert")}
              </button>
              <Link className="button ghost" href="/boutique">{fr ? "Conserver l’alerte" : "Keep the alert"}</Link>
            </div>
            {state === "error" && <p className="restock-manage-error-v428" role="alert">{message}</p>}
          </>
        )}
        {(state === "cancelled" || state === "inactive" || !validLink) && (
          <Link className="button primary" href="/boutique">{fr ? "Retour à la boutique" : "Back to the shop"}</Link>
        )}
      </section>
    </main>
  );
}
