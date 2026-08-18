import { NextResponse } from "next/server";
import { requirePickupStaff } from "@/lib/admin-auth";
import { verifyPickupQrPayload } from "@/lib/pickup-qr";

function pickupScanState(order: {
  status: string;
  payment_status: string;
  order_type: string;
}) {
  if (order.order_type !== "pickup") return "invalid";
  if (order.status === "completed") return "completed";
  if (["cancelled", "refunded"].includes(order.status)) return "unavailable";
  if (order.status !== "ready") return "not_ready";
  if (order.payment_status !== "paid") return "payment_required";
  return "ready";
}

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
      .select("order_number,status,payment_status,order_type")
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order || order.order_type !== "pickup") {
      return NextResponse.json(
        { error: "Commande de retrait introuvable.", state: "invalid" },
        { status: 404 }
      );
    }

    const state = pickupScanState(order);

    return NextResponse.json(
      {
        orderNumber: order.order_number,
        state,
        canHandoff: state === "ready",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan impossible." },
      { status }
    );
  }
}
