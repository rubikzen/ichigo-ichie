import { NextResponse } from "next/server";
import { requirePickupStaff } from "@/lib/admin-auth";
import { verifyPickupQrPayload } from "@/lib/pickup-qr";
import { normalizeLegacyProductLabel } from "@/lib/product-label";

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
      .select(`
        order_number,status,payment_status,order_type,
        customer_first_name,customer_last_name,
        order_items(product_name,quantity,choices)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (error || !order || order.order_type !== "pickup") {
      return NextResponse.json(
        { error: "Commande de retrait introuvable.", state: "invalid" },
        { status: 404 }
      );
    }

    const state = pickupScanState(order);
    const canRevealPickupDetails = [
      "ready",
      "completed",
      "payment_required",
      "not_ready",
    ].includes(state);

    const customerName = canRevealPickupDetails
      ? [order.customer_first_name, order.customer_last_name]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" ") || "Client"
      : undefined;

    const items = canRevealPickupDetails
      ? (order.order_items ?? []).map((item) => {
          const quantity = Number(item.quantity);
          const rawChoices = Array.isArray(item.choices) ? item.choices : [];
          const choices = rawChoices
            .map((choice: unknown) => {
              if (typeof choice === "string") return choice.trim();
              if (!choice || typeof choice !== "object") return "";
              const value = choice as Record<string, unknown>;
              return String(
                value.label ||
                  value.valueName ||
                  value.value_name ||
                  ""
              ).trim();
            })
            .filter(Boolean);

          return {
            name: normalizeLegacyProductLabel(
              String(item.product_name || "Article"),
              "fr"
            ),
            quantity:
              Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            choices,
          };
        })
      : undefined;

    return NextResponse.json(
      {
        orderNumber: order.order_number,
        state,
        workflowStatus: canRevealPickupDetails ? order.status : undefined,
        canPrepare:
          order.payment_status === "paid" && order.status === "pending",
        canMarkReady:
          order.payment_status === "paid" && order.status === "preparing",
        canHandoff: state === "ready",
        customerName,
        items,
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
