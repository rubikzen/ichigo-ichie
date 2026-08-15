import type { SupabaseClient } from "@supabase/supabase-js";
import { productVariantLabel } from "@/lib/product-label";

type RestockLocale = "fr" | "en";

type RestockSubscription = {
  id: string;
  product_id: string;
  variant_id: string | null;
  email: string;
  locale: RestockLocale;
  status: "active" | "notified" | "cancelled";
};

type RestockProduct = {
  id: string;
  slug: string;
  category_id: string;
  name_fr: string;
  name_en: string;
  active: boolean;
  stock: number;
};

type RestockVariant = {
  id: string;
  product_id: string;
  name: string;
  packaging: string | null;
  weight: string | null;
  stock: number;
  active: boolean;
};

export type RestockProcessResult = {
  productId: string;
  checked: number;
  eligible: number;
  sent: number;
  skipped: number;
  failed: number;
};

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char] || char,
  );
}

function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function availableProductStock(
  product: RestockProduct,
  variants: RestockVariant[],
) {
  const activeVariants = variants.filter((variant) => variant.active);
  if (activeVariants.length) {
    return activeVariants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stock) || 0),
      0,
    );
  }
  return Math.max(0, Number(product.stock) || 0);
}

function subscriptionIsAvailable(
  subscription: RestockSubscription,
  product: RestockProduct,
  variants: RestockVariant[],
) {
  if (!product.active) return false;

  if (subscription.variant_id) {
    const variant = variants.find(
      (item) => item.id === subscription.variant_id && item.active,
    );
    return Boolean(variant && Number(variant.stock) > 0);
  }

  return availableProductStock(product, variants) > 0;
}

async function loadBrand(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("site_settings")
    .select("key,value")
    .in("key", ["brand_name"]);

  const brandRow = (data ?? []).find((row) => row.key === "brand_name");
  const raw = brandRow?.value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "ICHIGO ICHIE";
}

function restockEmailHtml(input: {
  brand: string;
  locale: RestockLocale;
  productName: string;
  variantName: string;
  shopUrl: string;
}) {
  const fr = input.locale === "fr";
  const title = fr
    ? "Votre matcha est de retour"
    : "Your matcha is back";
  const intro = fr
    ? `${input.productName} est de nouveau disponible dans notre boutique en ligne.`
    : `${input.productName} is available again in our online shop.`;
  const detail = input.variantName
    ? `<div style="margin:18px 0;padding:14px 16px;border-radius:14px;background:#f5f2e8;color:#42564a"><strong>${escapeHtml(input.variantName)}</strong></div>`
    : "";
  const button = fr ? "Découvrir le produit" : "Shop now";
  const note = fr
    ? "Vous recevez cet e-mail uniquement parce que vous avez demandé une alerte de retour en stock pour ce produit."
    : "You are receiving this email only because you requested a back-in-stock alert for this product.";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f5f2e8;color:#26362d;font-family:Arial,sans-serif">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px">
      <div style="background:#fffdf8;border:1px solid #e7e2d8;border-radius:22px;padding:28px">
        <div style="font-size:12px;letter-spacing:.18em;font-weight:700;color:#486a4b">${escapeHtml(input.brand)}</div>
        <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;margin:10px 0 12px">${escapeHtml(title)}</h1>
        <p style="line-height:1.65;color:#59665f">${escapeHtml(intro)}</p>
        ${detail}
        <p style="margin:24px 0">
          <a href="${escapeHtml(input.shopUrl)}" style="display:inline-block;background:#294237;color:white;text-decoration:none;padding:12px 18px;border-radius:999px">${escapeHtml(button)}</a>
        </p>
        <p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e7e2d8;color:#7a837d;font-size:11px;line-height:1.55">${escapeHtml(note)}</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendRestockEmail(input: {
  subscription: RestockSubscription;
  brand: string;
  product: RestockProduct;
  variant: RestockVariant | null;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!input.subscription.email) {
    return { skipped: true as const, reason: "missing_recipient" as const };
  }
  if (!key || !from) {
    return { skipped: true as const, reason: "email_not_configured" as const };
  }

  const locale = input.subscription.locale === "en" ? "en" : "fr";
  const productName =
    locale === "fr"
      ? input.product.name_fr
      : input.product.name_en || input.product.name_fr;
  const variantName = input.variant
    ? productVariantLabel(input.variant, locale)
    : "";
  const subject =
    locale === "fr"
      ? `${input.brand} · ${productName} est de retour en stock`
      : `${input.brand} · ${productName} is back in stock`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `restock-${input.subscription.id}`.slice(0, 256),
    },
    body: JSON.stringify({
      from,
      to: [input.subscription.email],
      subject,
      html: restockEmailHtml({
        brand: input.brand,
        locale,
        productName,
        variantName,
        shopUrl: `${siteOrigin()}/boutique`,
      }),
    }),
  });

  if (!response.ok) {
    throw new Error(`RESEND_RESTOCK_${response.status}: ${await response.text()}`);
  }

  return { skipped: false as const, reason: "sent" as const };
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
) {
  const queue = [...values];
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), queue.length) },
    async () => {
      while (queue.length) {
        const value = queue.shift();
        if (value !== undefined) await worker(value);
      }
    },
  );
  await Promise.all(workers);
}

export async function processRestockNotificationsForProduct(
  supabase: SupabaseClient,
  productId: string,
): Promise<RestockProcessResult> {
  const { data: subscriptions, error: subscriptionError } = await supabase
    .from("restock_subscriptions")
    .select("id,product_id,variant_id,email,locale,status")
    .eq("product_id", productId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(200);

  if (subscriptionError) throw subscriptionError;

  const activeSubscriptions = (subscriptions ?? []) as RestockSubscription[];
  const empty: RestockProcessResult = {
    productId,
    checked: activeSubscriptions.length,
    eligible: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
  if (!activeSubscriptions.length) return empty;

  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("id,slug,category_id,name_fr,name_en,active,stock")
    .eq("id", productId)
    .maybeSingle();

  if (productError) throw productError;
  if (!productData) return empty;

  const product = productData as RestockProduct;

  const [{ data: category, error: categoryError }, { data: variantData, error: variantError }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("kind,active")
        .eq("id", product.category_id)
        .maybeSingle(),
      supabase
        .from("product_variants")
        .select("id,product_id,name,packaging,weight,stock,active")
        .eq("product_id", productId),
    ]);

  if (categoryError) throw categoryError;
  if (variantError) throw variantError;
  if (!category || !category.active || category.kind !== "shop") return empty;

  const variants = (variantData ?? []) as RestockVariant[];
  const eligible = activeSubscriptions.filter((subscription) =>
    subscriptionIsAvailable(subscription, product, variants),
  );

  const result: RestockProcessResult = {
    ...empty,
    eligible: eligible.length,
  };
  if (!eligible.length) return result;

  const brand = await loadBrand(supabase);

  await runWithConcurrency(eligible, 5, async (subscription) => {
    const variant = subscription.variant_id
      ? variants.find((item) => item.id === subscription.variant_id) ?? null
      : null;

    try {
      const sent = await sendRestockEmail({
        subscription,
        brand,
        product,
        variant,
      });

      if (sent.skipped) {
        result.skipped += 1;
        return;
      }

      const notifiedAt = new Date().toISOString();
      const { data: marked, error: markError } = await supabase
        .from("restock_subscriptions")
        .update({
          status: "notified",
          notified_at: notifiedAt,
        })
        .eq("id", subscription.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();

      if (markError) throw markError;
      if (marked) result.sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(
        `Restock notification failed for ${subscription.id}`,
        error,
      );
    }
  });

  return result;
}

export async function processRestockNotificationsForOrder(
  supabase: SupabaseClient,
  orderId: string,
) {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id")
    .eq("order_id", orderId)
    .not("product_id", "is", null);

  if (error) throw error;

  const productIds = [
    ...new Set(
      (data ?? [])
        .map((row) => String(row.product_id || ""))
        .filter(Boolean),
    ),
  ];

  const results: RestockProcessResult[] = [];
  for (const productId of productIds) {
    results.push(
      await processRestockNotificationsForProduct(supabase, productId),
    );
  }
  return results;
}
