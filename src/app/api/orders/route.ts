import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { OrderValidationError, resolveCart, type PayloadItem } from "@/lib/order-calculation";
import { getPackagingWeightG, getShippingQuotes, requireShippingQuote } from "@/lib/shipping";
import { createOrReuseStripeCheckout } from "@/lib/stripe";
import { sendOrderEmail, sendMerchantOrderNotification } from "@/lib/order-email";
import { PromoCodeError, resolvePromoCode } from "@/lib/promo";
import { assertInvoiceReadyForProducts, issueAndEmailInvoice } from "@/lib/invoice";
import { getCommerceEnvironment } from "@/lib/runtime-environment";
import { consumeRateLimit, PublicApiError, readJsonBody, tooManyRequests } from "@/lib/public-api";
import { getTermsVersion } from "@/lib/terms";


function orderErrorReference() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

type UnknownErrorShape = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  name?: unknown;
};

function errorShape(error: unknown): UnknownErrorShape {
  if (error && typeof error === "object") return error as UnknownErrorShape;
  return {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function classifyOrderError(error: unknown) {
  if (error instanceof PublicApiError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (error instanceof OrderValidationError) {
    return {
      status: error.status || 400,
      code: "ORDER_VALIDATION",
      message: error.message,
    };
  }

  const shape = errorShape(error);
  const dbCode = textValue(shape.code).toUpperCase();
  const message = error instanceof Error ? error.message : textValue(shape.message);
  const haystack = `${dbCode} ${message} ${textValue(shape.details)} ${textValue(shape.hint)}`.toLowerCase();

  if (["42703", "42P01", "42883", "PGRST202", "PGRST204"].includes(dbCode) ||
      haystack.includes("schema cache") || haystack.includes("does not exist") || haystack.includes("could not find the function")) {
    return {
      status: 500,
      code: dbCode === "42883" || haystack.includes("function") ? "ORDER_DATABASE_RPC" : "ORDER_DATABASE_SCHEMA",
      message: "La configuration de la boutique n’est pas encore synchronisée. Réessayez après la mise à jour de la base de données.",
    };
  }

  if (["23503", "23514", "22P02"].includes(dbCode)) {
    return { status: 500, code: "ORDER_DATABASE_DATA", message: "Certaines données de la commande ne sont pas compatibles avec la configuration actuelle de la boutique." };
  }

  if (dbCode === "23505") {
    return { status: 409, code: "ORDER_DATABASE_CONFLICT", message: "La commande existe déjà ou un conflit temporaire est survenu. Réessayez une fois." };
  }

  if (["42501", "PGRST301"].includes(dbCode) || haystack.includes("permission denied") || haystack.includes("not authorized")) {
    return { status: 500, code: "ORDER_DATABASE_ACCESS", message: "Le service de commande est momentanément indisponible." };
  }

  if (haystack.includes("invoice_vat_not_configured")) {
    return { status: 409, code: "ORDER_INVOICE_VAT", message: "La TVA d’un produit Boutique n’est pas encore configurée. La boutique doit corriger ce produit avant le paiement." };
  }
  if (haystack.includes("invoice_config_incomplete")) {
    return { status: 409, code: "ORDER_INVOICE_CONFIG", message: "La facturation automatique n’est pas complètement configurée dans l’administration." };
  }

  if (haystack.includes("stripe_secret_key") || haystack.includes("stripe n’est pas configur") || haystack.includes("stripe is not configured")) {
    return { status: 500, code: "ORDER_STRIPE_CONFIG", message: "Le paiement en ligne n’est pas encore configuré correctement." };
  }

  if (haystack.includes("stripe") || haystack.includes("checkout session") || haystack.includes("payment")) {
    return { status: 502, code: "ORDER_PAYMENT_SERVICE", message: "Impossible de préparer le paiement pour le moment. Réessayez dans quelques instants." };
  }

  if (haystack.includes("fetch failed") || haystack.includes("network") || haystack.includes("timeout")) {
    return { status: 503, code: "ORDER_SERVICE_UNAVAILABLE", message: "Un service nécessaire à la commande ne répond pas momentanément." };
  }

  return { status: 500, code: "ORDER_INTERNAL", message: "Impossible de finaliser la commande pour le moment." };
}

function localDebug(error: unknown) {
  if (process.env.NODE_ENV === "production") return undefined;
  const shape = errorShape(error);
  const parts = [
    textValue(shape.code) && `code=${textValue(shape.code)}`,
    (error instanceof Error ? error.message : textValue(shape.message)) && `message=${error instanceof Error ? error.message : textValue(shape.message)}`,
    textValue(shape.details) && `details=${textValue(shape.details)}`,
    textValue(shape.hint) && `hint=${textValue(shape.hint)}`,
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 1200) || "Erreur serveur sans détail exploitable.";
}

function orderNumber() {
  const now = new Date();
  const stamp = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  return `II-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredText(value: unknown, label: string, max = 160) {
  const text = String(value ?? "").trim();
  if (!text) throw new OrderValidationError(`${label} manquant.`);
  return text.slice(0, max);
}

function optionalText(value: unknown, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

function validatePickup(body: Record<string, unknown>) {
  const mode = body.pickupMode === "scheduled" ? "scheduled" : "asap";
  if (mode === "asap") return null;
  if (!body.pickupTime) throw new OrderValidationError("Choisissez une heure de retrait.");
  const pickupTime = new Date(String(body.pickupTime));
  if (Number.isNaN(pickupTime.getTime())) throw new OrderValidationError("Heure de retrait invalide.");
  const now = Date.now();
  if (pickupTime.getTime() < now + 10 * 60 * 1000) throw new OrderValidationError("Choisissez une heure au moins 10 minutes à l’avance.");
  if (pickupTime.getTime() > now + 7 * 24 * 60 * 60 * 1000) throw new OrderValidationError("Le retrait peut être planifié jusqu’à 7 jours à l’avance.");
  return pickupTime;
}

function validateShippingAddress(body: Record<string, any>) {
  const shipping = body.shipping ?? {};
  const address1 = requiredText(shipping.address1, "Adresse", 180);
  const address2 = optionalText(shipping.address2, 180) || null;
  const postalCode = requiredText(shipping.postalCode, "Code postal", 12).replace(/\s+/g, "");
  const city = requiredText(shipping.city, "Ville", 120);
  const country = String(shipping.country || "FR").trim().toUpperCase();
  if (country !== "FR") throw new OrderValidationError("La livraison est disponible uniquement en France métropolitaine pour le moment.");
  if (!/^\d{5}$/.test(postalCode)) throw new OrderValidationError("Code postal français invalide.");
  if (/^(97|98)/.test(postalCode)) throw new OrderValidationError("La livraison Outre-mer n’est pas encore disponible.");
  const methodId = requiredText(shipping.methodId, "Mode de livraison", 80);
  return { address1, address2, postalCode, city, country, methodId };
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    if (supabase) {
      const rateLimit = await consumeRateLimit(request, supabase, { scope: "orders:create", limit: 12, windowSeconds: 600 });
      if (!rateLimit.allowed) return tooManyRequests(rateLimit);
    }

    const body = await readJsonBody<Record<string, any>>(request, 96_000);
    const items = (body.items ?? []) as PayloadItem[];
    if (!Array.isArray(items) || !items.length || items.length > 30) throw new OrderValidationError("Panier invalide.");

    const orderType = body.orderType === "shipping" ? "shipping" : "pickup";
    const paymentMethod: "online" = "online";
    if (body.acceptedTerms !== true) throw new OrderValidationError("Vous devez accepter les CGV avant de commander.");
    const firstName = requiredText(body.customer?.firstName, "Prénom", 80);
    const lastName = orderType === "shipping" ? requiredText(body.customer?.lastName, "Nom", 80) : optionalText(body.customer?.lastName, 80);
    const email = requiredText(body.customer?.email, "Email", 160).toLowerCase();
    const phone = requiredText(body.customer?.phone, "Téléphone", 50);
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new OrderValidationError("Adresse email invalide.");
    const notes = optionalText(body.notes, 1000) || null;
    const pickupTime = orderType === "pickup" ? validatePickup(body) : null;
    const shippingAddress = orderType === "shipping" ? validateShippingAddress(body) : null;

    const clientReference = requiredText(body.clientReference, "Référence client", 50);
    if (!UUID_RE.test(clientReference)) throw new OrderValidationError("Référence de commande invalide.");

    const number = orderNumber();
    if (!supabase) return NextResponse.json({ orderNumber: number, demo: true });

    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id,order_number,public_token,total,pickup_time,order_type,source_channel,shipping_method_name,shipping_fee,package_weight_g,payment_status,payment_method,promo_code,discount_amount")
      .eq("client_reference", clientReference)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existingOrder) {
      if (paymentMethod === "online" && existingOrder.payment_status !== "paid") {
        const session = await createOrReuseStripeCheckout(supabase, existingOrder.id, new URL(request.url).origin);
        return NextResponse.json({
          orderNumber: existingOrder.order_number,
          publicToken: existingOrder.public_token,
          total: Number(existingOrder.total),
          orderType: existingOrder.order_type,
          sourceChannel: existingOrder.source_channel,
          paymentMethod: "online",
          paymentStatus: session.alreadyPaid ? "paid" : "pending",
          promoCode: existingOrder.promo_code,
          discountAmount: Number(existingOrder.discount_amount || 0),
          checkoutSessionClientSecret: session.clientSecret,
          checkoutSessionId: session.sessionId,
          trackingUrl: session.trackingUrl,
          paymentComplete: session.alreadyPaid,
          duplicate: true,
        });
      }
      return NextResponse.json({
        orderNumber: existingOrder.order_number,
        publicToken: existingOrder.public_token,
        total: Number(existingOrder.total),
        pickupTime: existingOrder.pickup_time,
        orderType: existingOrder.order_type,
        sourceChannel: existingOrder.source_channel,
        shippingMethodName: existingOrder.shipping_method_name,
        shippingFee: Number(existingOrder.shipping_fee || 0),
        packageWeightG: Number(existingOrder.package_weight_g || 0),
        paymentMethod: existingOrder.payment_method,
        paymentStatus: existingOrder.payment_status,
        promoCode: existingOrder.promo_code,
        discountAmount: Number(existingOrder.discount_amount || 0),
        duplicate: true,
      });
    }

    const cart = await resolveCart(supabase, items);

    const productIds = [...new Set(cart.normalized.map((item) => item.product_id).filter(Boolean))] as string[];
    const productVatMap = new Map<string, number | null>();
    if (productIds.length) {
      const { data: productRows, error: productKindError } = await supabase.from("products").select("id,category_id,name_fr,vat_rate").in("id", productIds);
      if (productKindError) throw productKindError;
      for (const row of productRows ?? []) {
        const rate = row.vat_rate == null || String(row.vat_rate).trim() === "" ? null : Number(row.vat_rate);
        productVatMap.set(row.id, Number.isFinite(rate as number) ? Number(rate) : null);
      }
      await assertInvoiceReadyForProducts(supabase, productIds);
      const categoryIds = [...new Set((productRows ?? []).map((row) => row.category_id).filter(Boolean))];
      if (categoryIds.length) {
        const { data: categoryRows, error: categoryKindError } = await supabase.from("categories").select("id,kind").in("id", categoryIds);
        if (categoryKindError) throw categoryKindError;
        const hasMenuItem = (categoryRows ?? []).some((row) => row.kind === "menu");
        if (hasMenuItem) throw new OrderValidationError("La carte boissons & desserts est uniquement informative. Commandez seulement les produits de la Boutique.");
      }
    }
    let promo = null;
    const requestedPromoCode = optionalText(body.promoCode, 40);
    if (requestedPromoCode) {
      try {
        promo = await resolvePromoCode(supabase, requestedPromoCode, cart.subtotal);
      } catch (promoError) {
        if (promoError instanceof PromoCodeError) {
          const validationError = new OrderValidationError(promoError.message);
          validationError.status = promoError.status;
          throw validationError;
        }
        throw promoError;
      }
    }
    const discountAmount = Number(promo?.discountAmount || 0);
    const discountedSubtotal = Math.max(0, Math.round((cart.subtotal - discountAmount) * 100) / 100);

    const sourceChannel: "shop" = "shop";
    let shippingFee = 0;
    let packageWeightG = 0;
    let shippingMethodName: string | null = null;
    let shippingMethodId: string | null = null;

    if (orderType === "shipping") {
      if (cart.containsPickupOnly) throw new OrderValidationError("Ce panier contient un article disponible uniquement en retrait boutique.");
      if (cart.missingShippingWeight) throw new OrderValidationError("Le poids d’expédition d’un produit n’est pas configuré.");
      const packagingWeightG = await getPackagingWeightG(supabase);
      packageWeightG = cart.itemWeightG + packagingWeightG;
      const quotes = await getShippingQuotes(supabase, {
        country: shippingAddress!.country,
        packageWeightG,
        subtotal: cart.subtotal,
      });
      const selected = requireShippingQuote(quotes, shippingAddress!.methodId);
      shippingFee = Math.round(selected.fee * 100) / 100;
      shippingMethodName = selected.nameFr;
      shippingMethodId = selected.id;
    }

    const total = Math.round((discountedSubtotal + shippingFee) * 100) / 100;
    const termsVersion = await getTermsVersion(supabase);
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      order_number: number,
      client_reference: clientReference,
      status: "pending",
      payment_status: "pending",
      payment_method: paymentMethod,
      order_type: orderType,
      source_channel: sourceChannel,
      environment: getCommerceEnvironment(),
      customer_first_name: firstName,
      customer_last_name: lastName,
      customer_email: email,
      customer_phone: phone,
      pickup_time: pickupTime?.toISOString() ?? null,
      notes,
      subtotal: cart.subtotal,
      promo_code_id: promo?.id ?? null,
      promo_code: promo?.code ?? null,
      discount_amount: discountAmount,
      shipping_fee: shippingFee,
      total,
      shipping_method_id: shippingMethodId,
      shipping_method_name: shippingMethodName,
      shipping_address1: shippingAddress?.address1 ?? null,
      shipping_address2: shippingAddress?.address2 ?? null,
      shipping_postal_code: shippingAddress?.postalCode ?? null,
      shipping_city: shippingAddress?.city ?? null,
      shipping_country: shippingAddress?.country ?? null,
      package_weight_g: packageWeightG,
      terms_accepted_at: new Date().toISOString(),
      terms_version: termsVersion,
    }).select("id,public_token").single();
    if (orderError || !order) throw orderError ?? new Error("Order insert failed");

    const { error: itemsError } = await supabase.from("order_items").insert(cart.normalized.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      vat_rate: item.product_id ? (productVatMap.get(item.product_id) ?? null) : null,
      choices: item.choices,
    })));
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    const { error: stockError } = await supabase.rpc("reserve_shop_order_stock", { p_order_id: order.id });
    if (stockError) {
      await supabase.from("orders").delete().eq("id", order.id);
      if (stockError.message?.includes("ICHIGO_STOCK_INSUFFICIENT")) {
        const stockValidationError = new OrderValidationError("Le stock vient de changer. Vérifiez votre panier et réessayez.");
        stockValidationError.status = 409;
        throw stockValidationError;
      }
      throw stockError;
    }

    if (promo) {
      const { error: promoReserveError } = await supabase.rpc("reserve_order_promo", { p_order_id: order.id });
      if (promoReserveError) {
        await supabase.rpc("release_shop_order_stock", { p_order_id: order.id });
        await supabase.from("orders").delete().eq("id", order.id);
        const message = promoReserveError.message || "";
        const validationError = new OrderValidationError(
          message.includes("ICHIGO_PROMO_USAGE_LIMIT") ? "Ce code promo a atteint sa limite d’utilisation." :
          message.includes("ICHIGO_PROMO_NOT_STARTED") ? "Ce code promo n’est pas encore disponible." :
          message.includes("ICHIGO_PROMO_EXPIRED") ? "Ce code promo a expiré." :
          message.includes("ICHIGO_PROMO_MINIMUM") ? "Le minimum d’achat requis pour ce code promo n’est plus atteint." :
          "Ce code promo n’est plus disponible."
        );
        validationError.status = 409;
        throw validationError;
      }
    }

    if (total <= 0) {
      const { error: freeOrderError } = await supabase.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", order.id);
      if (freeOrderError) throw freeOrderError;
      const { error: promoCommitError } = await supabase.rpc("commit_order_promo", { p_order_id: order.id });
      if (promoCommitError) console.error("Promo commit error", promoCommitError);
      try { await issueAndEmailInvoice(supabase, order.id); }
      catch (invoiceError) { console.error("Automatic invoice error", invoiceError); }
      if (email) {
        try { await sendOrderEmail(supabase, order.id, "confirmation"); }
        catch (emailError) { console.error("Order confirmation email error", emailError); }
      }
      try { await sendMerchantOrderNotification(supabase, order.id); }
      catch (merchantEmailError) { console.error("Merchant order notification email error", merchantEmailError); }
      return NextResponse.json({
        orderNumber: number, publicToken: order.public_token, total, subtotal: cart.subtotal,
        promoCode: promo?.code ?? null, discountAmount, pickupTime: pickupTime?.toISOString() ?? null,
        orderType, sourceChannel, shippingMethodName, shippingFee, packageWeightG, paymentMethod, paymentStatus: "paid",
      });
    }

    if (paymentMethod === "online") {
      try {
        const session = await createOrReuseStripeCheckout(supabase, order.id, new URL(request.url).origin);
        return NextResponse.json({
          orderNumber: number,
          publicToken: order.public_token,
          total,
          subtotal: cart.subtotal,
          promoCode: promo?.code ?? null,
          discountAmount,
          pickupTime: pickupTime?.toISOString() ?? null,
          orderType,
          sourceChannel,
          shippingMethodName,
          shippingFee,
          packageWeightG,
          paymentMethod,
          paymentStatus: session.alreadyPaid ? "paid" : "pending",
          checkoutSessionClientSecret: session.clientSecret,
          checkoutSessionId: session.sessionId,
          trackingUrl: session.trackingUrl,
          paymentComplete: session.alreadyPaid,
        });
      } catch (stripeError) {
        await supabase.rpc("release_shop_order_stock", { p_order_id: order.id });
        await supabase.from("orders").delete().eq("id", order.id);
        throw stripeError;
      }
    }

    if (email) {
      try { await sendOrderEmail(supabase, order.id, "confirmation"); }
      catch (emailError) { console.error("Order confirmation email error", emailError); }
    }

    return NextResponse.json({
      orderNumber: number,
      publicToken: order.public_token,
      total,
      subtotal: cart.subtotal,
      promoCode: promo?.code ?? null,
      discountAmount,
      pickupTime: pickupTime?.toISOString() ?? null,
      orderType,
      sourceChannel,
      shippingMethodName,
      shippingFee,
      packageWeightG,
      paymentMethod,
      paymentStatus: "unpaid",
    });
  } catch (error) {
    const reference = orderErrorReference();
    const classified = classifyOrderError(error);
    const shape = errorShape(error);
    console.error("[ORDER_ERROR]", {
      reference,
      publicCode: classified.code,
      dbCode: textValue(shape.code) || undefined,
      message: error instanceof Error ? error.message : textValue(shape.message) || String(error),
      details: textValue(shape.details) || undefined,
      hint: textValue(shape.hint) || undefined,
      error,
    });
    return NextResponse.json({
      error: classified.message,
      code: classified.code,
      reference,
      debug: localDebug(error),
    }, { status: classified.status });
  }
}