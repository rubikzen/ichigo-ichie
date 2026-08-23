"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

type LookupOrder = {
  orderNumber: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  orderType: string;
  items: Array<{ id: string; productName: string; quantity: number }>;
};

type SuccessState = {
  requestNumber: string;
  submittedAt: string;
  acknowledgementEmail: string;
  acknowledgementSent: boolean;
};

function localDate(value: string, language: "fr" | "en") {
  return new Date(value).toLocaleString(language === "fr" ? "fr-FR" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export function WithdrawalPageClient() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [order, setOrder] = useState<LookupOrder | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [acknowledgementEmail, setAcknowledgementEmail] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [clientReference, setClientReference] = useState("");
  const [busy, setBusy] = useState<"lookup" | "submit" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const allSelected = useMemo(
    () => Boolean(order?.items.length) && selected.length === order?.items.length,
    [order, selected],
  );

  async function lookup(event: FormEvent) {
    event.preventDefault();
    setBusy("lookup");
    setError("");
    setSuccess(null);

    try {
      const response = await fetch("/api/withdrawal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "lookup", orderNumber, email, website }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Commande introuvable.");

      const next = data.order as LookupOrder;
      setOrder(next);
      setSelected(next.items.map((item) => item.id));
      setFirstName(next.firstName || "");
      setLastName(next.lastName || "");
      setAcknowledgementEmail(email.trim().toLowerCase());
      setConfirmed(false);
      setClientReference(crypto.randomUUID());
    } catch (lookupError) {
      setOrder(null);
      setError(lookupError instanceof Error ? lookupError.message : "Commande introuvable.");
    } finally {
      setBusy("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    if (!selected.length) {
      setError(isFr ? "Sélectionnez au moins un article." : "Select at least one item.");
      return;
    }

    setBusy("submit");
    setError("");

    try {
      const reference = clientReference || crypto.randomUUID();
      if (!clientReference) setClientReference(reference);

      const response = await fetch("/api/withdrawal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          orderNumber: order.orderNumber,
          email,
          firstName,
          lastName,
          acknowledgementEmail,
          itemIds: selected,
          customerNote,
          confirmed,
          clientReference: reference,
          locale: language,
          website,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isFr ? "Enregistrement impossible." : "Unable to submit the declaration."));
      }

      setSuccess({
        requestNumber: data.requestNumber,
        submittedAt: data.submittedAt,
        acknowledgementEmail: data.acknowledgementEmail,
        acknowledgementSent: Boolean(data.acknowledgementSent),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isFr ? "Enregistrement impossible." : "Unable to submit the declaration.",
      );
    } finally {
      setBusy("");
    }
  }

  if (success) {
    return (
      <div className="withdrawal-page-v484">
        <section className="withdrawal-success-v484" data-withdrawal-success-v484>
          <p className="eyebrow">ICHIGO ICHIE</p>
          <h1>{isFr ? "Votre déclaration a été reçue" : "Your withdrawal declaration was received"}</h1>
          <p>
            {isFr
              ? "Votre déclaration est enregistrée avec une date et une heure de réception."
              : "Your declaration has been recorded with its receipt date and time."}
          </p>

          <dl>
            <div><dt>{isFr ? "Référence" : "Reference"}</dt><dd>{success.requestNumber}</dd></div>
            <div><dt>{isFr ? "Reçue le" : "Received on"}</dt><dd>{localDate(success.submittedAt, language)}</dd></div>
            <div>
              <dt>{isFr ? "Accusé de réception" : "Acknowledgement"}</dt>
              <dd>
                {success.acknowledgementSent
                  ? `${isFr ? "Envoyé à" : "Sent to"} ${success.acknowledgementEmail}`
                  : isFr
                    ? `Déclaration enregistrée. L’envoi e-mail à ${success.acknowledgementEmail} doit être vérifié.`
                    : `Declaration recorded. Email delivery to ${success.acknowledgementEmail} needs verification.`}
              </dd>
            </div>
          </dl>

          <p className="withdrawal-legal-note-v484">
            {isFr
              ? "Cet accusé confirme la réception de votre déclaration. L’applicabilité du droit de rétractation et les suites éventuelles sont examinées conformément aux CGV et à la loi."
              : "This acknowledgement confirms receipt of your declaration. Eligibility and any subsequent action are reviewed under the terms and applicable law."}
          </p>

          <div className="withdrawal-actions-v484">
            <button type="button" onClick={() => window.print()}>{isFr ? "Imprimer / enregistrer" : "Print / save"}</button>
            <Link href="/">{isFr ? "Retour à l’accueil" : "Back to home"}</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="withdrawal-page-v484" data-withdrawal-page-v484>
      <header className="withdrawal-hero-v484">
        <p className="eyebrow">{isFr ? "RENONCER AU CONTRAT ICI" : "WITHDRAW FROM CONTRACT"}</p>
        <h1>{isFr ? "Rétractation en ligne" : "Online withdrawal"}</h1>
        <p>
          {isFr
            ? "Identifiez votre commande, vérifiez les biens concernés puis confirmez votre décision. Aucune justification n’est demandée."
            : "Identify your order, review the goods concerned and confirm your decision. No reason is required."}
        </p>
      </header>

      <section className="withdrawal-card-v484">
        {!order ? (
          <form onSubmit={lookup} className="withdrawal-form-v484">
            <div className="withdrawal-step-v484">
              <span>01</span>
              <div>
                <strong>{isFr ? "Identifier la commande" : "Identify the order"}</strong>
                <small>{isFr ? "Utilisez le numéro et l’e-mail de la commande." : "Use the order number and email used for the purchase."}</small>
              </div>
            </div>

            <label>
              {isFr ? "Numéro de commande" : "Order number"}
              <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="II-260823-1234" autoComplete="off" required />
            </label>

            <label>
              {isFr ? "E-mail de la commande" : "Order email"}
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>

            <label className="withdrawal-honeypot-v484" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
            </label>

            {error && <p className="withdrawal-error-v484">{error}</p>}

            <button type="submit" className="withdrawal-primary-v484" disabled={busy === "lookup"}>
              {busy === "lookup" ? (isFr ? "Vérification…" : "Checking…") : (isFr ? "Continuer" : "Continue")}
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="withdrawal-form-v484">
            <div className="withdrawal-step-v484">
              <span>02</span>
              <div>
                <strong>{isFr ? "Vérifier et confirmer" : "Review and confirm"}</strong>
                <small>{isFr ? `Commande ${order.orderNumber} · ${localDate(order.createdAt, language)}` : `Order ${order.orderNumber} · ${localDate(order.createdAt, language)}`}</small>
              </div>
            </div>

            <fieldset className="withdrawal-items-v484">
              <legend>{isFr ? "Biens concernés" : "Goods concerned"}</legend>
              <label className="withdrawal-select-all-v484">
                <input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? order.items.map((item) => item.id) : [])} />
                {isFr ? "Toute la commande" : "Entire order"}
              </label>

              {order.items.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...new Set([...current, item.id])]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span><strong>{item.quantity} × {item.productName}</strong></span>
                </label>
              ))}
            </fieldset>

            <div className="form-grid withdrawal-identity-v484">
              <label>{isFr ? "Prénom" : "First name"}<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
              <label>{isFr ? "Nom" : "Last name"}<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
            </div>

            <label>
              {isFr ? "E-mail pour recevoir l’accusé de réception" : "Email for the acknowledgement"}
              <input type="email" value={acknowledgementEmail} onChange={(event) => setAcknowledgementEmail(event.target.value)} required />
            </label>

            <label>
              {isFr ? "Note facultative" : "Optional note"}
              <textarea
                rows={4}
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder={isFr ? "Vous n’avez pas à justifier votre décision." : "You do not have to justify your decision."}
              />
            </label>

            <div className="withdrawal-review-v484">
              <strong>{isFr ? "Avant de confirmer" : "Before confirming"}</strong>
              <p>
                {isFr
                  ? "La soumission enregistre votre déclaration immédiatement. Elle ne déclenche pas automatiquement un remboursement ni une annulation : l’applicabilité du droit et les modalités de retour sont traitées conformément aux CGV."
                  : "Submitting records your declaration immediately. It does not automatically trigger a refund or cancellation: eligibility and return arrangements are handled under the terms."}
              </p>
            </div>

            <label className="withdrawal-confirm-v484">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required />
              <span>
                {isFr
                  ? "Je confirme vouloir exercer mon droit de rétractation pour les biens sélectionnés."
                  : "I confirm that I wish to exercise my right of withdrawal for the selected goods."}
              </span>
            </label>

            {error && <p className="withdrawal-error-v484">{error}</p>}

            <div className="withdrawal-submit-row-v484">
              <button type="button" onClick={() => { setOrder(null); setError(""); setConfirmed(false); }}>
                {isFr ? "← Modifier la commande" : "← Change order"}
              </button>
              <button type="submit" className="withdrawal-primary-v484" disabled={!confirmed || busy === "submit"}>
                {busy === "submit" ? (isFr ? "Enregistrement…" : "Submitting…") : (isFr ? "Confirmer ma rétractation" : "Confirm my withdrawal")}
              </button>
            </div>
          </form>
        )}
      </section>

      <aside className="withdrawal-help-v484">
        <strong>{isFr ? "Besoin d’aide ?" : "Need help?"}</strong>
        <p>
          {isFr
            ? "Vous pouvez également exercer votre droit par toute déclaration dénuée d’ambiguïté selon les modalités prévues dans les CGV."
            : "You may also exercise your right by any unambiguous statement under the methods described in the terms."}
        </p>
        <Link href="/cgv">{isFr ? "Consulter les CGV →" : "View terms →"}</Link>
      </aside>
    </div>
  );
}
