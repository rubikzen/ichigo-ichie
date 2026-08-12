import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { resolveCart, type PayloadItem } from "@/lib/order-calculation";
import { PromoCodeError, resolvePromoCode } from "@/lib/promo";
import { consumeRateLimit, publicApiErrorInfo, readJsonBody, tooManyRequests } from "@/lib/public-api";

export async function POST(request: Request) {
  try {
    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
    const rateLimit = await consumeRateLimit(request, supabase, { scope: "promo:validate", limit: 30, windowSeconds: 600 });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const body = await readJsonBody<{ code?: unknown; items?: PayloadItem[] }>(request, 48_000);
    const items = body.items ?? [];
    if (!Array.isArray(items) || !items.length || items.length > 30) {
      return NextResponse.json({ error: "Panier invalide." }, { status: 400 });
    }

    const cart = await resolveCart(supabase, items);
    const promo = await resolvePromoCode(supabase, body.code, cart.subtotal);
    if (!promo) return NextResponse.json({ error: "Saisissez un code promo." }, { status: 400 });

    return NextResponse.json({
      valid: true,
      code: promo.code,
      campaignName: promo.campaignName,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      discountAmount: promo.discountAmount,
      subtotal: cart.subtotal,
      subtotalAfterDiscount: Math.round((cart.subtotal - promo.discountAmount) * 100) / 100,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    const publicError = publicApiErrorInfo(error);
    const status = publicError?.status ?? (error instanceof PromoCodeError ? error.status : 500);
    const code = publicError?.code;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Code promo invalide.", ...(code ? { code } : {}) }, { status });
  }
}
