import QRCode from "qrcode";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { createPickupQrPayload } from "@/lib/pickup-qr";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!UUID_RE.test(token)) {
    return new Response("QR introuvable.", { status: 404 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return new Response("Service indisponible.", { status: 503 });
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select("id,order_type,status")
    .eq("public_token", token)
    .maybeSingle();

  if (
    error ||
    !order ||
    order.order_type !== "pickup" ||
    ["cancelled", "refunded"].includes(order.status)
  ) {
    return new Response("QR introuvable.", { status: 404 });
  }

  try {
    const payload = createPickupQrPayload(order.id);
    const svg = await QRCode.toString(payload, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260,
      color: {
        dark: "#244336",
        light: "#fffdf8",
      },
    });

    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (qrError) {
    console.error("Pickup QR generation error", qrError);
    return new Response("QR indisponible.", { status: 503 });
  }
}
