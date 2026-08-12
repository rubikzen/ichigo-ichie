import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { consumeRateLimit, tooManyRequests } from "@/lib/public-api";
import { cancelUnpaidOrder } from "@/lib/order-cancellation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!UUID_RE.test(token)) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const supabase = createServiceSupabase();
    if (!supabase) {
      return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
    }

    const rateLimit = await consumeRateLimit(request, supabase, {
      scope: "orders:cancel",
      limit: 10,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return tooManyRequests(rateLimit);

    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("public_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const result = await cancelUnpaidOrder(supabase, order.id, {
      actor: "customer",
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          cancelled: result.cancelled,
        },
        { status: result.httpStatus },
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      paymentStatus: result.paymentStatus,
    });
  } catch (error) {
    console.error("Customer order cancel error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Annulation impossible." },
      { status: 500 },
    );
  }
}
