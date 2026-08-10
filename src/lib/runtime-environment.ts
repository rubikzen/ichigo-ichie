export type CommerceEnvironment = "test" | "live";
export type StripeKeyMode = CommerceEnvironment | "unknown";

export function stripeSecretMode(value = process.env.STRIPE_SECRET_KEY): StripeKeyMode {
  const key = String(value || "").trim();
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return "unknown";
}

export function stripePublishableMode(value = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY): StripeKeyMode {
  const key = String(value || "").trim();
  if (/^pk_test_/.test(key)) return "test";
  if (/^pk_live_/.test(key)) return "live";
  return "unknown";
}

// Unknown/missing Stripe configuration always falls back to test. A missing or
// malformed key must never make an order look like a production transaction.
export function getCommerceEnvironment(): CommerceEnvironment {
  return stripeSecretMode() === "live" ? "live" : "test";
}

export function stripeEnvironmentIsConsistent() {
  const secret = stripeSecretMode();
  const publishable = stripePublishableMode();
  return secret !== "unknown" && publishable !== "unknown" && secret === publishable;
}
