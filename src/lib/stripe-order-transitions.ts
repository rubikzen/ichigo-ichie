/**
 * Only unresolved payment states may be changed by delayed Stripe events.
 * Supabase queries must use these lists as WHERE predicates, not just as
 * pre-flight JS checks, to remain safe under concurrent webhook delivery.
 */
export const PAYMENT_PENDING_SOURCE_STATES = ["unpaid", "pending"] as const;
export const PAYMENT_UNPAID_SOURCE_STATES = ["unpaid", "pending", "failed", "expired"] as const;
