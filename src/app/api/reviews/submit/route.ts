import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import {
  consumeRateLimit,
  publicApiErrorInfo,
  PublicApiError,
  readJsonBody,
  tooManyRequests,
} from "@/lib/public-api";
import { settingEnabled, siteSettingDefaults } from "@/lib/settings";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function publicAuthorName(firstName: unknown, lastName: unknown) {
  const first = clean(firstName, 50);
  const last = clean(lastName, 50);
  if (first && last) return `${first} ${last.slice(0, 1).toUpperCase()}.`;
  if (first) return first;
  return "Client vérifié";
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 12_000);

    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const orderToken = clean(body.orderToken, 160);
    const productId = clean(body.productId, 64);
    const rating = Number(body.rating);
    const title = clean(body.title, 120);
    const reviewBody = clean(body.body, 2000);

    if (
      orderToken.length < 16 ||
      !UUID_RE.test(productId) ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5 ||
      reviewBody.length < 2
    ) {
      throw new PublicApiError("Avis invalide.", 400, "REVIEW_INVALID");
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service indisponible.", code: "REVIEW_SERVICE_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "reviews:submit:v466",
      limit: 5,
      windowSeconds: 600,
    });

    if (!rateLimit.allowed) {
      return tooManyRequests(
        rateLimit,
        "Trop de tentatives. Réessayez dans quelques instants.",
      );
    }

    const { data: settingRows, error: settingError } = await supabase
      .from("site_settings")
      .select("key,value")
      .in("key", ["shop_reviews_enabled", "shop_reviews_moderation_mode"]);

    if (settingError) {
      console.warn("Review settings lookup failed; using defaults", settingError.message);
    }

    const reviewSettings = {
      ...siteSettingDefaults,
      ...Object.fromEntries(
        (settingRows ?? []).map((row) => [String(row.key), String(row.value ?? "")]),
      ),
    };

    if (!settingEnabled(reviewSettings.shop_reviews_enabled)) {
      throw new PublicApiError(
        "Les avis clients sont actuellement désactivés.",
        403,
        "REVIEWS_DISABLED",
      );
    }

    const reviewStatus =
      reviewSettings.shop_reviews_moderation_mode === "auto"
        ? "approved"
        : "pending";

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,customer_first_name,customer_last_name,payment_status,status,order_items(id,product_id,product_name)",
      )
      .eq("public_token", orderToken)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!order) {
      throw new PublicApiError(
        "Commande introuvable.",
        404,
        "REVIEW_ORDER_NOT_FOUND",
      );
    }

    if (
      order.payment_status !== "paid" ||
      order.status !== "completed"
    ) {
      throw new PublicApiError(
        "L’avis sera disponible une fois la commande payée et terminée.",
        409,
        "REVIEW_ORDER_NOT_ELIGIBLE",
      );
    }

    const orderItem = (order.order_items ?? []).find(
      (item) => String(item.product_id || "") === productId,
    );

    if (!orderItem) {
      throw new PublicApiError(
        "Ce produit ne fait pas partie de cette commande.",
        403,
        "REVIEW_PRODUCT_NOT_PURCHASED",
      );
    }

    const { error: insertError } = await supabase
      .from("product_reviews")
      .insert({
        product_id: productId,
        order_id: order.id,
        order_item_id: orderItem.id,
        author_name: publicAuthorName(
          order.customer_first_name,
          order.customer_last_name,
        ),
        rating,
        title: title || null,
        body: reviewBody,
        status: reviewStatus,
      });

    if (insertError?.code === "23505") {
      throw new PublicApiError(
        "Vous avez déjà envoyé un avis pour ce produit avec cette commande.",
        409,
        "REVIEW_ALREADY_SUBMITTED",
      );
    }

    if (insertError) throw insertError;

    return NextResponse.json(
      { ok: true, status: reviewStatus },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const publicError = publicApiErrorInfo(error);
    if (publicError) {
      return NextResponse.json(
        { error: publicError.message, code: publicError.code },
        {
          status: publicError.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    console.error("Verified review submission failed", error);
    return NextResponse.json(
      {
        error: "Impossible d’enregistrer l’avis pour le moment.",
        code: "REVIEW_SUBMIT_FAILED",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
