import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoResolution = {
  id: string;
  code: string;
  campaignName: string;
  discountType: "percent" | "fixed";
  discountValue: number;
  discountAmount: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
};

export class PromoCodeError extends Error {
  status = 400;
}

export function normalizePromoCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .slice(0, 40);
}

function moneyRound(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function resolvePromoCode(
  supabase: SupabaseClient,
  rawCode: unknown,
  subtotal: number,
): Promise<PromoResolution | null> {
  const code = normalizePromoCode(rawCode);
  if (!code) return null;
  const { data: promoSetting } = await supabase.from("site_settings").select("value").eq("key", "promo_field_visible").maybeSingle();
  if (promoSetting && String(promoSetting.value) === "false") {
    throw new PromoCodeError("Les codes promo ne sont pas disponibles pour le moment.");
  }
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
    throw new PromoCodeError("Code promo invalide.");
  }

  const { data, error } = await supabase
    .from("promo_codes")
    .select("id,code,campaign_name,discount_type,discount_value,min_order_amount,max_discount_amount,starts_at,ends_at,usage_limit,used_count,reserved_count,active")
    .eq("code", code)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new PromoCodeError("Ce code promo n’existe pas.");
  if (!data.active) throw new PromoCodeError("Ce code promo n’est pas actif.");

  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) {
    throw new PromoCodeError("Ce code promo n’est pas encore disponible.");
  }
  if (data.ends_at && new Date(data.ends_at).getTime() < now) {
    throw new PromoCodeError("Ce code promo a expiré.");
  }

  const minOrderAmount = Number(data.min_order_amount || 0);
  if (subtotal + 0.0001 < minOrderAmount) {
    throw new PromoCodeError(`Ce code est valable à partir de ${minOrderAmount.toFixed(2).replace(".", ",")} € d’achat.`);
  }

  const usageLimit = data.usage_limit == null ? null : Number(data.usage_limit);
  const usedCount = Number(data.used_count || 0);
  const reservedCount = Number(data.reserved_count || 0);
  if (usageLimit != null && usedCount + reservedCount >= usageLimit) {
    throw new PromoCodeError("Ce code promo a atteint sa limite d’utilisation.");
  }

  const discountType = data.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(data.discount_value || 0);
  const maxDiscountAmount = data.max_discount_amount == null ? null : Number(data.max_discount_amount);

  let discountAmount = discountType === "fixed"
    ? discountValue
    : subtotal * discountValue / 100;
  if (maxDiscountAmount != null && discountType === "percent") {
    discountAmount = Math.min(discountAmount, maxDiscountAmount);
  }
  discountAmount = moneyRound(Math.max(0, Math.min(subtotal, discountAmount)));
  if (discountAmount <= 0) throw new PromoCodeError("Ce code promo ne génère aucune réduction sur cette commande.");

  return {
    id: data.id,
    code: data.code,
    campaignName: String(data.campaign_name || data.code),
    discountType,
    discountValue,
    discountAmount,
    minOrderAmount,
    maxDiscountAmount,
  };
}
