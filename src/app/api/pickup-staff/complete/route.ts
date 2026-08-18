import { NextResponse } from "next/server";
import { requirePickupStaff } from "@/lib/admin-auth";
import { verifyPickupQrPayload } from "@/lib/pickup-qr";
import { sendOrderEmail } from "@/lib/order-email";

export async function POST(request: Request) {
  try {
    const { supabase } = await requirePickupStaff(request);
    const body = (await request.json()) as Record<string, unknown>;
    const orderId = verifyPickupQrPayload(body.qr);

    if (!orderId) {
      return NextResponse.json(
        { error: "QR de retrait invalide.", state: "invalid" },
        { status: 400 }
      );
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select("id,order_number,status,payment_status,order_type")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order || order.order_type !== "pickup") {
      return NextResponse.json(
        { error: "Commande de retrait introuvable.", state: "invalid" },
        { status: 404 }
      );
    }

    if (order.status === "completed") {
      return NextResponse.json({
        ok: true,
        orderNumber: order.order_number,
        state: "completed",
        alreadyCompleted: true,
      });
    }

    if (["cancelled", "refunded"].includes(order.status)) {
      return NextResponse.json(
        {
          error: "Cette commande ne peut plus être remise.",
          orderNumber: order.order_number,
          state: "unavailable",
        },
        { status: 409 }
      );
    }

    if (order.status !== "ready") {
      return NextResponse.json(
        {
          error: "La commande n’est pas encore prête.",
          orderNumber: order.order_number,
          state: "not_ready",
        },
        { status: 409 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        {
          error: "Le paiement doit être confirmé en caisse avant la remise.",
          orderNumber: order.order_number,
          state: "payment_required",
        },
        { status: 409 }
      );
    }

    const { data: completed, error: updateError } = await supabase
      .from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("order_type", "pickup")
      .eq("status", "ready")
      .eq("payment_status", "paid")
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;

    if (!completed) {
      return NextResponse.json(
        {
          error: "La commande a changé. Scannez de nouveau le QR.",
          orderNumber: order.order_number,
          state: "refresh_required",
        },
        { status: 409 }
      );
    }

    let pickupEmail: string = "not_attempted";
    try {
      const emailResult = await sendOrderEmail(
        supabase,
        order.id,
        "pickup_completed"
      );
      pickupEmail = emailResult.skipped ? emailResult.reason : "sent";
    } catch (emailError) {
      pickupEmail = "failed";
      console.error("Pickup staff completed email error", emailError);
    }

    return NextResponse.json({
      ok: true,
      orderNumber: order.order_number,
      state: "completed",
      pickupEmail,
    });
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    console.error("Pickup staff completion error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Remise impossible.",
      },
      { status }
    );
  }
}
