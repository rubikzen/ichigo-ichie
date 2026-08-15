import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { sendRestockSubscriptionConfirmation } from "@/lib/restock-subscription";
import {
  consumeRateLimit,
  PublicApiError,
  publicApiErrorInfo,
  readJsonBody,
  tooManyRequests,
} from "@/lib/public-api";

export const runtime = "nodejs";

// Product IDs are stored in PostgreSQL UUID columns. Accept the canonical UUID
// shape without restricting the UUID version nibble; the database remains the
// source of truth for whether the identifier exists and belongs to a product.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value: unknown, max: number) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<Record<string, unknown>>(request, 8_000);

    // Honeypot: bots filling this field get a harmless success response.
    if (clean(body.website, 200)) {
      return NextResponse.json({ ok: true });
    }

    const productId = clean(body.productId, 64);
    const variantId = clean(body.variantId, 64);
    const email = clean(body.email, 254).toLowerCase();
    const locale = clean(body.locale, 2) === "en" ? "en" : "fr";

    if (!UUID_RE.test(productId)) {
      throw new PublicApiError(
        locale === "fr" ? "Produit invalide." : "Invalid product.",
        400,
        "RESTOCK_PRODUCT_INVALID",
      );
    }
    if (variantId && !UUID_RE.test(variantId)) {
      throw new PublicApiError(
        locale === "fr" ? "Format invalide." : "Invalid variant.",
        400,
        "RESTOCK_VARIANT_INVALID",
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new PublicApiError(
        locale === "fr" ? "Adresse e-mail invalide." : "Invalid email address.",
        400,
        "RESTOCK_EMAIL_INVALID",
      );
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json(
        { error: "Service indisponible.", code: "RESTOCK_SERVICE_UNAVAILABLE" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "restock:subscribe",
      limit: 6,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) {
      return tooManyRequests(
        rateLimit,
        "Trop de demandes. Réessayez dans quelques instants.",
      );
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id,name_fr,name_en,active,stock,category_id")
      .eq("id", productId)
      .maybeSingle();

    if (productError) throw productError;
    if (!product || !product.active) {
      throw new PublicApiError(
        locale === "fr" ? "Produit introuvable." : "Product not found.",
        404,
        "RESTOCK_PRODUCT_NOT_FOUND",
      );
    }

    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("kind,active")
      .eq("id", product.category_id)
      .maybeSingle();

    if (categoryError) throw categoryError;
    if (!category || !category.active || category.kind !== "shop") {
      throw new PublicApiError(
        locale === "fr" ? "Produit introuvable." : "Product not found.",
        404,
        "RESTOCK_PRODUCT_NOT_FOUND",
      );
    }

    if (variantId) {
      const { data: variant, error: variantError } = await supabase
        .from("product_variants")
        .select("id,product_id,active,stock")
        .eq("id", variantId)
        .eq("product_id", productId)
        .maybeSingle();

      if (variantError) throw variantError;
      if (!variant || !variant.active) {
        throw new PublicApiError(
          locale === "fr" ? "Format introuvable." : "Variant not found.",
          404,
          "RESTOCK_VARIANT_NOT_FOUND",
        );
      }
      if (Number(variant.stock) > 0) {
        throw new PublicApiError(
          locale === "fr"
            ? "Ce format est déjà de retour en stock."
            : "This variant is already back in stock.",
          409,
          "RESTOCK_AVAILABLE",
        );
      }
    } else {
      const { data: variants, error: variantsError } = await supabase
        .from("product_variants")
        .select("id,stock")
        .eq("product_id", productId)
        .eq("active", true);

      if (variantsError) throw variantsError;
      const totalStock = variants?.length
        ? variants.reduce(
            (sum, variant) => sum + Math.max(0, Number(variant.stock) || 0),
            0,
          )
        : Math.max(0, Number(product.stock) || 0);

      if (totalStock > 0) {
        throw new PublicApiError(
          locale === "fr"
            ? "Ce produit est déjà de retour en stock."
            : "This product is already back in stock.",
          409,
          "RESTOCK_AVAILABLE",
        );
      }
    }

    let existingQuery = supabase
      .from("restock_subscriptions")
      .select("id")
      .eq("product_id", productId)
      .eq("email", email)
      .eq("status", "active");

    existingQuery = variantId
      ? existingQuery.eq("variant_id", variantId)
      : existingQuery.is("variant_id", null);

    const { data: existing, error: existingError } =
      await existingQuery.maybeSingle();

    if (existingError) throw existingError;
    if (existing) {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("restock_subscriptions")
      .insert({
        product_id: productId,
        variant_id: variantId || null,
        email,
        locale,
        status: "active",
      })
      .select("id")
      .single();

    // Race-safe duplicate handling: the partial unique index is the final guard.
    if (insertError?.code === "23505") {
      return NextResponse.json({
        ok: true,
        alreadySubscribed: true,
      });
    }
    if (insertError || !inserted) {
      throw insertError ?? new Error("RESTOCK_SUBSCRIPTION_INSERT_FAILED");
    }

    try {
      const productName =
        locale === "fr" ? product.name_fr : product.name_en || product.name_fr;
      await sendRestockSubscriptionConfirmation({
        subscriptionId: inserted.id,
        email,
        locale,
        productName,
      });
    } catch (confirmationError) {
      // The registration is the source of truth. Email delivery must not
      // discard a valid waitlist subscription.
      console.error("Restock confirmation email error", confirmationError);
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (error) {
    console.error("Restock subscription error", error);
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
    return NextResponse.json(
      {
        error: "Impossible d’enregistrer cette demande pour le moment.",
        code: "RESTOCK_SUBSCRIPTION_FAILED",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
