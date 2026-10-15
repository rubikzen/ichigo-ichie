import type { SupabaseClient } from "@supabase/supabase-js";

export type FulfilmentMode = "pickup" | "shipping";

export function checkoutFulfilmentModes(settings: Record<string, string | undefined>) {
  return {
    pickupEnabled: settings.checkout_pickup_enabled !== "false",
    shippingEnabled: settings.checkout_shipping_enabled !== "false",
  };
}

// Do not use the cached storefront settings for this decision. An admin
// disabling a mode must immediately block new orders at the server.
export async function loadCheckoutFulfilmentModes(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("site_settings")
    .select("key,value")
    .in("key", ["checkout_pickup_enabled", "checkout_shipping_enabled"]);
  if (error) throw error;
  const settings = Object.fromEntries((data ?? []).map((row) => [row.key, String(row.value ?? "")]));
  return checkoutFulfilmentModes(settings);
}

export function checkoutFulfilmentError(
  mode: FulfilmentMode,
  availability: ReturnType<typeof checkoutFulfilmentModes>,
) {
  if (mode === "pickup" && !availability.pickupEnabled) {
    return "Le retrait boutique est temporairement indisponible.";
  }
  if (mode === "shipping" && !availability.shippingEnabled) {
    return "La livraison est temporairement indisponible.";
  }
  return null;
}
