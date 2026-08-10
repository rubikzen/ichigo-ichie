import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { OrderValidationError, resolveCart, type PayloadItem } from "@/lib/order-calculation";
import { getPackagingWeightG, getShippingQuotes } from "@/lib/shipping";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const items = (body.items ?? []) as PayloadItem[];
    const country = String(body.country || "FR").trim().toUpperCase();
    if (country !== "FR") throw new OrderValidationError("La livraison est disponible uniquement en France métropolitaine pour le moment.");

    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

    const cart = await resolveCart(supabase, items);
    if (cart.containsPickupOnly) throw new OrderValidationError("Ce panier contient un article disponible uniquement en retrait boutique.");
    if (cart.missingShippingWeight) throw new OrderValidationError("Le poids d’expédition d’un produit n’est pas configuré.");

    const packagingWeightG = await getPackagingWeightG(supabase);
    const packageWeightG = cart.itemWeightG + packagingWeightG;
    const methods = await getShippingQuotes(supabase, { country, packageWeightG, subtotal: cart.subtotal });
    if (!methods.length) throw new OrderValidationError("Aucun tarif de livraison n’est configuré pour ce poids.");

    return NextResponse.json({
      subtotal: cart.subtotal,
      itemWeightG: cart.itemWeightG,
      packagingWeightG,
      packageWeightG,
      methods,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(error);
    const status = error instanceof OrderValidationError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible de calculer la livraison." }, { status });
  }
}
