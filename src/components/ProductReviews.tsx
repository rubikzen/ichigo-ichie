"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Review = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  createdAt: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
};

type ReviewPayload = {
  count: number;
  average: number;
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  reviews: Review[];
};

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="review-stars-v466" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <span
          key={index}
          className={index < Math.round(value) ? "filled" : ""}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </span>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const { language } = useLanguage();
  const [data, setData] = useState<ReviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"recent" | "rating">("recent");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `/api/reviews/product/${encodeURIComponent(productId)}`,
        );
        const payload = (await response.json()) as ReviewPayload;
        if (active && response.ok) setData(payload);
      } catch {
        // Secondary content: never block product purchase.
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [productId]);

  const reviews = useMemo(() => {
    const rows = [...(data?.reviews ?? [])];
    if (sort === "rating") {
      rows.sort(
        (a, b) =>
          b.rating - a.rating ||
          new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
      );
    }
    return rows;
  }, [data, sort]);

  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(
        language === "fr" ? "fr-FR" : "en-GB",
        { year: "numeric", month: "short", day: "numeric" },
      ),
    [language],
  );

  return (
    <section
      className="product-reviews-v466"
      aria-labelledby="product-reviews-title-v466"
    >
      <div className="product-reviews-head-v466">
        <div>
          <p className="eyebrow">
            {language === "fr" ? "AVIS CLIENTS" : "CUSTOMER REVIEWS"}
          </p>
          <h2 id="product-reviews-title-v466">
            {language === "fr"
              ? "Ce qu’en pensent nos clients"
              : "What our customers say"}
          </h2>
        </div>

        {data && data.count > 0 && (
          <div className="product-review-score-v466">
            <strong>{data.average.toFixed(1).replace(".", ",")}</strong>
            <div>
              <Stars value={data.average} label={`${data.average} / 5`} />
              <small>
                {data.count}{" "}
                {language === "fr"
                  ? "avis"
                  : data.count === 1
                    ? "review"
                    : "reviews"}
              </small>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <p className="muted">
          {language === "fr" ? "Chargement des avis…" : "Loading reviews…"}
        </p>
      ) : !data?.count ? (
        <div className="product-review-empty-v466">
          <strong>
            {language === "fr" ? "Pas encore d’avis" : "No reviews yet"}
          </strong>
          <p>
            {language === "fr"
              ? "Les avis sont réservés aux clients ayant réellement acheté ce produit."
              : "Reviews are reserved for customers who actually purchased this product."}
          </p>
        </div>
      ) : (
        <>
          <div className="product-review-overview-v466">
            <div className="product-review-bars-v466">
              {[5, 4, 3, 2, 1].map((rating) => {
                const count =
                  data.distribution[
                    String(rating) as keyof typeof data.distribution
                  ] || 0;
                const width = data.count
                  ? Math.round((count / data.count) * 100)
                  : 0;

                return (
                  <div key={rating}>
                    <span>{rating} ★</span>
                    <i>
                      <b style={{ width: `${width}%` }} />
                    </i>
                    <small>{count}</small>
                  </div>
                );
              })}
            </div>

            <label className="product-review-sort-v466">
              <span>{language === "fr" ? "Trier" : "Sort"}</span>
              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as "recent" | "rating")
                }
              >
                <option value="recent">
                  {language === "fr" ? "Plus récents" : "Most recent"}
                </option>
                <option value="rating">
                  {language === "fr" ? "Meilleure note" : "Highest rating"}
                </option>
              </select>
            </label>
          </div>

          <div className="product-review-list-v466">
            {reviews.map((review) => (
              <article key={review.id}>
                <div className="product-review-meta-v466">
                  <div>
                    <Stars
                      value={review.rating}
                      label={`${review.rating} / 5`}
                    />
                    <span className="verified-purchase-v466">
                      ✓{" "}
                      {language === "fr"
                        ? "Achat vérifié"
                        : "Verified purchase"}
                    </span>
                  </div>
                  <time dateTime={review.createdAt}>
                    {dateFormat.format(new Date(review.createdAt))}
                  </time>
                </div>

                <h3>
                  {review.title ||
                    (language === "fr" ? "Avis client" : "Customer review")}
                </h3>
                <p>{review.body}</p>
                <strong className="product-review-author-v466">
                  {review.authorName}
                </strong>

                {review.adminReply && (
                  <div className="product-review-reply-v466">
                    <small>ICHIGO ICHIE</small>
                    <strong>
                      {language === "fr"
                        ? "Réponse de la maison"
                        : "Reply from Ichigo Ichie"}
                    </strong>
                    <p>{review.adminReply}</p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
