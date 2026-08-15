"use client";

import { useState, type FormEvent } from "react";

type Props = {
  productId: string;
  productName: string;
  language: "fr" | "en";
  context?: "card" | "modal";
};

export function RestockNotify({
  productId,
  productName,
  language,
  context = "card",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || status === "loading") return;

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch("/api/restock/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId,
          email: email.trim(),
          locale: language,
          website,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            (language === "fr"
              ? "Inscription impossible pour le moment."
              : "Unable to subscribe right now."),
        );
      }

      setStatus("success");
      setMessage(
        language === "fr"
          ? `C’est noté. Nous vous préviendrons lorsque ${productName} sera de retour.`
          : `You're on the list. We'll let you know when ${productName} is back.`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : language === "fr"
            ? "Inscription impossible pour le moment."
            : "Unable to subscribe right now.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className={`restock-notify-v425 restock-notify-${context}-v425 is-success`}
        role="status"
        aria-live="polite"
      >
        <span aria-hidden="true">✓</span>
        <div>
          <strong>
            {language === "fr" ? "Alerte enregistrée" : "Restock alert saved"}
          </strong>
          <small>{message}</small>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`restock-notify-v425 restock-notify-${context}-v425 ${
        expanded ? "is-open" : ""
      }`}
    >
      {!expanded ? (
        <button
          type="button"
          className="button full restock-notify-trigger-v425"
          onClick={() => setExpanded(true)}
        >
          {language === "fr"
            ? "Me prévenir du retour en stock"
            : "Notify me when back in stock"}
        </button>
      ) : (
        <form className="restock-notify-form-v425" onSubmit={submit}>
          <label>
            <span>
              {language === "fr"
                ? "Votre adresse e-mail"
                : "Your email address"}
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="email@exemple.com"
              required
              autoFocus
            />
          </label>

          <input
            className="restock-honeypot-v425"
            type="text"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div className="restock-notify-actions-v425">
            <button
              type="submit"
              className="button primary"
              disabled={status === "loading"}
            >
              {status === "loading"
                ? language === "fr"
                  ? "Enregistrement…"
                  : "Saving…"
                : language === "fr"
                  ? "M’inscrire"
                  : "Notify me"}
            </button>
            <button
              type="button"
              className="restock-notify-cancel-v425"
              disabled={status === "loading"}
              onClick={() => {
                setExpanded(false);
                setStatus("idle");
                setMessage("");
              }}
            >
              {language === "fr" ? "Annuler" : "Cancel"}
            </button>
          </div>

          <small className="restock-privacy-v425">
            {language === "fr"
              ? "Votre e-mail sera utilisé uniquement pour cette alerte de retour en stock."
              : "Your email will only be used for this back-in-stock alert."}
          </small>

          {status === "error" && (
            <p className="restock-notify-error-v425" role="alert">
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
