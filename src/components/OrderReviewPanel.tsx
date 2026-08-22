"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { normalizeLegacyProductLabel } from "@/lib/product-label";

type ReviewItem = {
  id: string;
  product_id?: string | null;
  product_name: string;
};

export function OrderReviewPanel({
  token,
  items,
  paymentStatus,
  status,
}: {
  token: string;
  items: ReviewItem[];
  paymentStatus: string;
  status: string;
}) {
  const { language } = useLanguage();
  const products = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const productId = String(item.product_id || "");
      if (!productId || seen.has(productId)) return false;
      seen.add(productId);
      return true;
    });
  }, [items]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState<Set<string>>(() => new Set());

  if (
    paymentStatus !== "paid" ||
    status !== "completed" ||
    !products.length
  ) {
    return null;
  }

  const selected = products.find(
    (item) => item.product_id === selectedProductId,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected?.product_id || sending) return;

    setSending(true);
    setMessage("");

    try {
      const response = await fetch("/api/reviews/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderToken: token,
          productId: selected.product_id,
          rating,
          title,
          body,
          website,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        if (data.code === "REVIEW_ALREADY_SUBMITTED") {
          setSubmitted((current) => {
            const next = new Set(current);
            next.add(selected.product_id as string);
            return next;
          });
          setSelectedProductId("");
          setMessage(
            language === "fr"
              ? "Un avis a déjà été envoyé pour ce produit."
              : "A review has already been submitted for this product.",
          );
          return;
        }
        throw new Error(
          data.error ||
            (language === "fr"
              ? "Envoi impossible."
              : "Unable to submit review."),
        );
      }

      setSubmitted((current) => {
        const next = new Set(current);
        next.add(selected.product_id as string);
        return next;
      });
      setSelectedProductId("");
      setRating(5);
      setTitle("");
      setBody("");
      setMessage(
        language === "fr"
          ? "Merci ! Votre avis sera publié après validation."
          : "Thank you! Your review will be published after moderation.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : language === "fr"
            ? "Envoi impossible."
            : "Unable to submit review.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className="order-review-panel-v466"
      aria-labelledby="order-review-title-v466"
    >
      <div className="order-review-panel-head-v466">
        <div>
          <p className="eyebrow">
            {language === "fr" ? "VOTRE EXPÉRIENCE" : "YOUR EXPERIENCE"}
          </p>
          <h2 id="order-review-title-v466">
            {language === "fr" ? "Donnez votre avis" : "Review your purchase"}
          </h2>
        </div>
        <span className="verified-purchase-v466">
          ✓{" "}
          {language === "fr" ? "Achat vérifié" : "Verified purchase"}
        </span>
      </div>

      <p className="muted">
        {language === "fr"
          ? "Seuls les produits de cette commande payée et terminée peuvent être évalués."
          : "Only products from this paid and completed order can be reviewed."}
      </p>

      <div className="order-review-products-v466">
        {products.map((item) => {
          const productId = String(item.product_id);
          const done = submitted.has(productId);

          return (
            <button
              type="button"
              key={productId}
              className={selectedProductId === productId ? "active" : ""}
              disabled={done}
              onClick={() => {
                setSelectedProductId(productId);
                setMessage("");
              }}
            >
              <span>
                {normalizeLegacyProductLabel(item.product_name, language)}
              </span>
              <strong>
                {done
                  ? language === "fr"
                    ? "Avis envoyé ✓"
                    : "Review sent ✓"
                  : language === "fr"
                    ? "Donner mon avis"
                    : "Write a review"}
              </strong>
            </button>
          );
        })}
      </div>

      {selected && (
        <form className="order-review-form-v466" onSubmit={submit}>
          <fieldset>
            <legend>
              {language === "fr" ? "Votre note" : "Your rating"}
            </legend>
            <div className="order-review-stars-v466">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  type="button"
                  key={value}
                  className={value <= rating ? "active" : ""}
                  aria-label={`${value} / 5`}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>

          <label>
            <span>
              {language === "fr" ? "Titre (facultatif)" : "Title (optional)"}
            </span>
            <input
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                language === "fr"
                  ? "Ex. Matcha très équilibré"
                  : "e.g. Beautifully balanced matcha"
              }
            />
          </label>

          <label>
            <span>{language === "fr" ? "Votre avis" : "Your review"}</span>
            <textarea
              required
              minLength={2}
              maxLength={2000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                language === "fr"
                  ? "Goût, texture, préparation, packaging…"
                  : "Taste, texture, preparation, packaging…"
              }
            />
          </label>

          <label className="review-honeypot-v466" aria-hidden="true">
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>

          <div className="order-review-form-actions-v466">
            <button
              type="button"
              className="button ghost"
              onClick={() => setSelectedProductId("")}
            >
              {language === "fr" ? "Annuler" : "Cancel"}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={sending || body.trim().length < 2}
            >
              {sending
                ? language === "fr"
                  ? "Envoi…"
                  : "Sending…"
                : language === "fr"
                  ? "Envoyer mon avis"
                  : "Submit review"}
            </button>
          </div>
        </form>
      )}

      {message && (
        <p className="order-review-message-v466" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
