import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { getStripeServer, markStripeOrderPaid, markStripeOrderUnpaid } from "@/lib/stripe";
import { sendOrderEmail } from "@/lib/order-email";
import { issueAndEmailCreditNote } from "@/lib/invoice";

export const runtime = "nodejs";

async function syncRefund(supabase: NonNullable<ReturnType<typeof createServiceSupabase>>, refund: Stripe.Refund) {
  const orderId = refund.metadata?.order_id;
  if (!orderId) return;

  if (refund.status === "succeeded") {
    await supabase.from("orders").update({
      status: "refunded",
      payment_status: "refunded",
      stripe_refund_id: refund.id,
      refunded_at: new Date().toISOString(),
    }).eq("id", orderId);
    try { await issueAndEmailCreditNote(supabase, orderId); }
    catch (invoiceError) { console.error("Credit note error", invoiceError); }
    try { await sendOrderEmail(supabase, orderId, "refund"); }
    catch (emailError) { console.error("Refund email error", emailError); }
    return;
  }

  if (refund.status === "failed" || refund.status === "canceled") {
    await supabase.from("orders").update({
      payment_status: "refund_failed",
      stripe_refund_id: refund.id,
    }).eq("id", orderId);
    return;
  }

  await supabase.from("orders").update({
    payment_status: "refund_pending",
    stripe_refund_id: refund.id,
  }).eq("id", orderId);
}

export async function POST(request: Request) {
  const stripe = getStripeServer();
  const supabase = createServiceSupabase();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !supabase || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook non configuré." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature Stripe absente." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature error", error);
    return NextResponse.json({ error: "Signature Stripe invalide." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") await markStripeOrderPaid(supabase, session);
      else if (session.metadata?.order_id) {
        await supabase.from("orders").update({ payment_status: "pending", stripe_checkout_session_id: session.id }).eq("id", session.metadata.order_id);
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      await markStripeOrderPaid(supabase, event.data.object as Stripe.Checkout.Session);
    } else if (event.type === "checkout.session.async_payment_failed") {
      await markStripeOrderUnpaid(supabase, event.data.object as Stripe.Checkout.Session, "failed");
    } else if (event.type === "checkout.session.expired") {
      await markStripeOrderUnpaid(supabase, event.data.object as Stripe.Checkout.Session, "expired");
    } else if (event.type === "refund.created" || event.type === "refund.updated" || event.type === "refund.failed") {
      await syncRefund(supabase, event.data.object as Stripe.Refund);
    }
  } catch (error) {
    console.error("Stripe webhook processing error", error);
    return NextResponse.json({ error: "Erreur de traitement Stripe." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
