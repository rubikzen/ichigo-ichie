import { NextResponse } from "next/server";
import { requirePickupStaff } from "@/lib/admin-auth";
import { verifyPickupQrPayload } from "@/lib/pickup-qr";
import { sendOrderEmail } from "@/lib/order-email";

const TARGETS = new Set(["preparing", "ready"]);

export async function POST(request: Request) {
  try {
    const { supabase } = await requirePickupStaff(request);
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = verifyPickupQrPayload(body.qr);
    const target = String(body.target || "").trim();

    if (!orderId) {
      return NextResponse.json({ error: "Lien de retrait invalide.", state: "invalid" }, { status: 400 });
    }
    if (!TARGETS.has(target)) {
      return NextResponse.json({ error: "Étape de retrait invalide." }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,order_number,status,payment_status,order_type")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order || order.order_type !== "pickup") {
      return NextResponse.json({ error: "Commande de retrait introuvable.", state: "invalid" }, { status: 404 });
    }
    if (["cancelled", "refunded", "completed"].includes(order.status)) {
      return NextResponse.json({
        error: "Cette commande ne peut plus avancer dans la préparation.",
        orderNumber: order.order_number,
        state: order.status === "completed" ? "completed" : "unavailable",
      }, { status: 409 });
    }
    if (order.payment_status !== "paid") {
      return NextResponse.json({
        error: "Le paiement doit être confirmé avant la préparation.",
        orderNumber: order.order_number,
        state: "payment_required",
      }, { status: 409 });
    }

    const expectedCurrent = target === "preparing" ? "pending" : "preparing";
    if (order.status === target) {
      return NextResponse.json({
        ok: true,
        orderNumber: order.order_number,
        workflowStatus: target,
        state: target === "ready" ? "ready" : "not_ready",
        canPrepare: false,
        canMarkReady: target === "preparing",
        canHandoff: target === "ready",
        alreadyApplied: true,
        pickupEmail: null,
      });
    }
    if (order.status !== expectedCurrent) {
      return NextResponse.json({
        error: "L’état de la commande a changé. Rechargez-la avant de continuer.",
        orderNumber: order.order_number,
        state: "refresh_required",
      }, { status: 409 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ status: target })
      .eq("id", order.id)
      .eq("order_type", "pickup")
      .eq("payment_status", "paid")
      .eq("status", expectedCurrent)
      .select("id")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json({
        error: "L’état de la commande a changé. Rechargez-la avant de continuer.",
        orderNumber: order.order_number,
        state: "refresh_required",
      }, { status: 409 });
    }

    let pickupEmail:
      | "sent"
      | "already_sent"
      | "missing_recipient"
      | "email_not_configured"
      | "failed"
      | null = null;

    if (target === "ready") {
      try {
        const emailResult = await sendOrderEmail(supabase, order.id, "pickup_ready");
        pickupEmail = emailResult.skipped ? emailResult.reason : "sent";
      } catch (emailError) {
        pickupEmail = "failed";
        console.error("Pickup staff ready email error", emailError);
      }
    }

    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      workflowStatus: target,
      state: target === "ready" ? "ready" : "not_ready",
      canPrepare: false,
      canMarkReady: target === "preparing",
      canHandoff: target === "ready",
      pickupEmail,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? (error as { status: number }).status
      : 500;
    console.error("Pickup staff status error", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Mise à jour du retrait impossible.",
    }, { status });
  }
}
