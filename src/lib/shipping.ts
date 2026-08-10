import type { SupabaseClient } from "@supabase/supabase-js";
import { OrderValidationError } from "@/lib/order-calculation";

export type ShippingQuote = {
  id: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  fee: number;
  freeThreshold: number | null;
  free: boolean;
  maxWeightG: number;
};

export async function getPackagingWeightG(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("site_settings").select("value").eq("key", "shipping_packaging_weight_g").maybeSingle();
  if (error) throw error;
  const raw = data?.value;
  const value = typeof raw === "string" ? Number(raw) : Number(raw ?? 120);
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 120;
}

export async function getShippingQuotes(
  supabase: SupabaseClient,
  { country, packageWeightG, subtotal }: { country: string; packageWeightG: number; subtotal: number },
): Promise<ShippingQuote[]> {
  const normalizedCountry = country.toUpperCase();
  const { data: methods, error: methodError } = await supabase
    .from("shipping_methods")
    .select("id,name_fr,name_en,description_fr,description_en,active,countries,free_threshold,sort_order")
    .eq("active", true)
    .order("sort_order");
  if (methodError) throw methodError;

  const eligibleMethods = (methods ?? []).filter((method) => Array.isArray(method.countries) && method.countries.includes(normalizedCountry));
  if (!eligibleMethods.length) return [];

  const methodIds = eligibleMethods.map((method) => method.id);
  const { data: rates, error: rateError } = await supabase
    .from("shipping_rate_bands")
    .select("method_id,max_weight_g,price,sort_order")
    .in("method_id", methodIds)
    .order("max_weight_g");
  if (rateError) throw rateError;

  return eligibleMethods.flatMap((method) => {
    const band = (rates ?? [])
      .filter((rate) => rate.method_id === method.id)
      .sort((a, b) => Number(a.max_weight_g) - Number(b.max_weight_g))
      .find((rate) => Number(rate.max_weight_g) >= packageWeightG);
    if (!band) return [];
    const freeThreshold = method.free_threshold == null ? null : Number(method.free_threshold);
    const free = freeThreshold != null && subtotal >= freeThreshold;
    return [{
      id: method.id,
      nameFr: method.name_fr,
      nameEn: method.name_en,
      descriptionFr: method.description_fr ?? "",
      descriptionEn: method.description_en ?? "",
      fee: free ? 0 : Number(band.price),
      freeThreshold,
      free,
      maxWeightG: Number(band.max_weight_g),
    } satisfies ShippingQuote];
  });
}

export function requireShippingQuote(quotes: ShippingQuote[], methodId: string) {
  const quote = quotes.find((method) => method.id === methodId);
  if (!quote) throw new OrderValidationError("Mode de livraison indisponible pour ce colis.");
  return quote;
}
