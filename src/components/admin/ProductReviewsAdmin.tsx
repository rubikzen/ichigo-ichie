"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type ReviewStatus = "pending" | "approved" | "hidden";

type AdminReview = {
  id: string;
  productId: string;
  productName: string;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  status: ReviewStatus;
  adminReply: string;
  adminRepliedAt: string | null;
  createdAt: string;
};

const FILTERS = [
  ["pending", "À valider"],
  ["approved", "Publiés"],
  ["hidden", "Masqués"],
  ["all", "Tous"],
] as const;

export function ProductReviewsAdmin({
  supabase,
}: {
  supabase: SupabaseClient;
}) {
  const [filter, setFilter] = useState<
    "pending" | "approved" | "hidden" | "all"
  >("pending");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session admin expirée.");

      const response = await fetch(
        `/api/admin/reviews?status=${encodeURIComponent(filter)}`,
        {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        reviews?: AdminReview[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Chargement impossible.");
      }

      const rows = payload.reviews ?? [];
      setReviews(rows);
      setReplies(
        Object.fromEntries(
          rows.map((review) => [review.id, review.adminReply || ""]),
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Chargement impossible.",
      );
    } finally {
      setLoading(false);
    }
  }, [filter, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      visible: reviews.length,
      five: reviews.filter((review) => review.rating === 5).length,
    }),
    [reviews],
  );

  async function patch(
    review: AdminReview,
    input: { status?: ReviewStatus; adminReply?: string },
  ) {
    setSavingId(review.id);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Session admin expirée.");

      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: review.id, ...input }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Modification impossible.");
      }

      setMessage("Avis enregistré ✓");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Modification impossible.",
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="admin-reviews-v466">
      <div className="section-inline admin-reviews-head-v466">
        <div>
          <p className="eyebrow">AVIS CLIENTS</p>
          <h3>Avis produits vérifiés</h3>
          <p className="muted">
            Chaque avis provient d’une commande payée et terminée. Les
            nouveaux avis restent privés jusqu’à validation.
          </p>
        </div>
        <button
          type="button"
          className="button ghost small"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualiser
        </button>
      </div>

      <div className="admin-reviews-summary-v466">
        <span>
          <strong>{counts.visible}</strong> dans cette vue
        </span>
        <span>
          <strong>{counts.five}</strong> avis 5★
        </span>
      </div>

      <div className="order-filter-buttons admin-review-filters-v466">
        {FILTERS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? "active" : ""}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p className="muted">{message}</p>}

      {loading ? (
        <div className="loading-card">Chargement des avis…</div>
      ) : reviews.length ? (
        <div className="admin-review-list-v466">
          {reviews.map((review) => (
            <article key={review.id}>
              <div className="admin-review-top-v466">
                <div>
                  <strong>{review.productName}</strong>
                  <span>
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                <span className={`review-status-v466 ${review.status}`}>
                  {review.status === "pending"
                    ? "À valider"
                    : review.status === "approved"
                      ? "Publié"
                      : "Masqué"}
                </span>
              </div>

              <div className="admin-review-meta-v466">
                <strong>{review.authorName}</strong>
                <span>✓ Achat vérifié</span>
                <time dateTime={review.createdAt}>
                  {new Intl.DateTimeFormat("fr-FR").format(
                    new Date(review.createdAt),
                  )}
                </time>
              </div>

              {review.title && <h4>{review.title}</h4>}
              <p>{review.body}</p>

              <label className="admin-review-reply-v466">
                <span>Réponse Ichigo Ichie</span>
                <textarea
                  maxLength={2000}
                  value={replies[review.id] ?? ""}
                  onChange={(event) =>
                    setReplies((current) => ({
                      ...current,
                      [review.id]: event.target.value,
                    }))
                  }
                  placeholder="Réponse facultative visible sous l’avis…"
                />
              </label>

              <div className="admin-review-actions-v466">
                <button
                  type="button"
                  className="button ghost small"
                  disabled={savingId === review.id}
                  onClick={() =>
                    void patch(review, {
                      adminReply: replies[review.id] ?? "",
                    })
                  }
                >
                  Enregistrer la réponse
                </button>

                {review.status !== "approved" && (
                  <button
                    type="button"
                    className="button primary small"
                    disabled={savingId === review.id}
                    onClick={() =>
                      void patch(review, {
                        status: "approved",
                        adminReply: replies[review.id] ?? "",
                      })
                    }
                  >
                    Publier
                  </button>
                )}

                {review.status !== "hidden" && (
                  <button
                    type="button"
                    className="button ghost small"
                    disabled={savingId === review.id}
                    onClick={() =>
                      void patch(review, { status: "hidden" })
                    }
                  >
                    Masquer
                  </button>
                )}

                {review.status !== "pending" && (
                  <button
                    type="button"
                    className="button ghost small"
                    disabled={savingId === review.id}
                    onClick={() =>
                      void patch(review, { status: "pending" })
                    }
                  >
                    Remettre à valider
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">Aucun avis dans cette vue.</div>
      )}
    </section>
  );
}
