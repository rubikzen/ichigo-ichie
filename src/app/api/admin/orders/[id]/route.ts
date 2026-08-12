import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getStripeServer } from "@/lib/stripe";
import { sendOrderEmail } from "@/lib/order-email";
import { issueAndEmailCreditNote, issueAndEmailInvoice } from "@/lib/invoice";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(["pending", "preparing", "ready", "completed", "cancelled", "refunded"]);

function clean(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    const { supabase } = await requireAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const status = clean(body.status, 30);
    if (status && !ORDER_STATUSES.has(status)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });

    const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();
    if (error || !order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    const trackingCarrier = clean(body.trackingCarrier ?? order.tracking_carrier, 120) || null;
    const trackingNumber = clean(body.trackingNumber ?? order.tracking_number, 160) || null;
    const trackingUrlRaw = clean(body.trackingUrl ?? order.tracking_url, 500);
    const trackingUrl = trackingUrlRaw && /^https?:\/\//i.test(trackingUrlRaw) ? trackingUrlRaw : null;

    if (body.markPaid === true) {
      if (order.payment_method !== "pickup") return NextResponse.json({ error: "Ce bouton est réservé au paiement au retrait." }, { status: 409 });
      const { error: paidError } = await supabase.from("orders").update({ payment_status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (paidError) throw paidError;
      try { await issueAndEmailInvoice(supabase, id); } catch (invoiceError) { console.error("Manual payment invoice error", invoiceError); }
      return NextResponse.json({ ok: true });
    }

    if (status === "refunded") {
      if (order.payment_method !== "online") {
        return NextResponse.json({ error: "Le remboursement Stripe est disponible uniquement pour les paiements en ligne." }, { status: 409 });
      }
      if (!["paid", "refund_failed"].includes(order.payment_status)) {
        return NextResponse.json({ error: order.payment_status === "refunded" ? "Cette commande est déjà remboursée." : "Cette commande n’est pas dans un état remboursable." }, { status: 409 });
      }
      if (!order.stripe_payment_intent_id) return NextResponse.json({ error: "PaymentIntent Stripe introuvable." }, { status: 409 });
      const stripe = getStripeServer();
      if (!stripe) return NextResponse.json({ error: "Stripe n’est pas configuré." }, { status: 503 });

      const refund = await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        reason: "requested_by_customer",
        metadata: { order_id: order.id, order_number: order.order_number },
      });

      if (refund.status === "succeeded") {
        const { error: updateError } = await supabase.from("orders").update({
          status: "refunded", payment_status: "refunded", stripe_refund_id: refund.id, refunded_at: new Date().toISOString(),
        }).eq("id", id);
        if (updateError) throw updateError;
        try { await issueAndEmailCreditNote(supabase, id); } catch (invoiceError) { console.error("Credit note error", invoiceError); }
        try { await sendOrderEmail(supabase, id, "refund"); } catch (emailError) { console.error("Refund email error", emailError); }
      } else if (refund.status === "failed" || refund.status === "canceled") {
        await supabase.from("orders").update({ payment_status: "refund_failed", stripe_refund_id: refund.id }).eq("id", id);
        return NextResponse.json({ error: "Stripe n’a pas pu lancer le remboursement. Vérifiez le Dashboard Stripe." }, { status: 409 });
      } else {
        await supabase.from("orders").update({ payment_status: "refund_pending", stripe_refund_id: refund.id }).eq("id", id);
      }
      return NextResponse.json({ ok: true, refundStatus: refund.status });
    }

    if (status === "cancelled" && order.payment_method === "online" && ["paid", "refund_pending", "refund_failed"].includes(order.payment_status)) {
      return NextResponse.json({ error: order.payment_status === "refund_pending" ? "Un remboursement Stripe est déjà en cours." : "Le paiement reste encaissé : utilisez « Rembourser via Stripe » au lieu d’annuler." }, { status: 409 });
    }
    if (status && ["pending", "preparing", "ready", "completed"].includes(status) && order.payment_method === "online" && order.payment_status !== "paid") {
      return NextResponse.json({ error: "Le paiement Stripe doit être confirmé avant de préparer la commande." }, { status: 409 });
    }
    if (order.order_type === "shipping" && status === "completed" && !trackingNumber) {
      return NextResponse.json({ error: "Ajoutez le numéro de suivi avant de marquer le colis comme expédié." }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      tracking_carrier: trackingCarrier,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl,
    };
    if (status) patch.status = status;
    if (order.order_type === "shipping" && status === "completed" && !order.shipped_at) patch.shipped_at = new Date().toISOString();

    const { error: updateError } = await supabase.from("orders").update(patch).eq("id", id);
    if (updateError) throw updateError;

    let shippingEmail:
      | "sent"
      | "already_sent"
      | "missing_recipient"
      | "email_not_configured"
      | "failed"
      | null = null;

    if (order.order_type === "shipping" && status === "completed") {
      try {
        const emailResult = await sendOrderEmail(supabase, id, "shipping");
        shippingEmail = emailResult.skipped ? emailResult.reason : "sent";
      } catch (emailError) {
        shippingEmail = "failed";
        console.error("Shipping email error", emailError);
      }
    }

    return NextResponse.json({ ok: true, shippingEmail });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    console.error("Admin order update error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Modification impossible." }, { status });
  }
}
