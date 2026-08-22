import { createServiceSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/public-api";

export type PersistedConversionEvent = {
  event: string;
  session_id: string;
  occurred_at: string;
  path: string;
  currency?: "EUR";
  product_id?: string;
  variant_id?: string;
  source?: "product_page" | "product_modal" | "reorder";
  order_type?: "pickup" | "shipping";
  value?: number;
  quantity?: number;
  item_count?: number;
  transaction_ref?: string;
};

export async function persistConversionEvent(
  request: Request,
  record: PersistedConversionEvent,
) {
  const vercelEnvironment = process.env.VERCEL_ENV;
  if (
    process.env.E2E_LOCAL === "1" ||
    process.env.NODE_ENV !== "production" ||
    (vercelEnvironment && vercelEnvironment !== "production")
  ) {
    return false;
  }

  try {
    const client = createServiceSupabase();
    if (!client) return false;

    const rateLimit = await consumeRateLimit(request, client, {
      scope: "analytics:conversion:v464",
      limit: 240,
      windowSeconds: 600,
    });

    // Silent drop keeps telemetry abuse from affecting storefront behavior.
    if (!rateLimit.allowed) return false;

    const { error } = await client.from("conversion_events").insert(record);
    if (error) {
      console.warn("[conversion:v464] persistence unavailable", error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "[conversion:v464] persistence failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return false;
  }
}
