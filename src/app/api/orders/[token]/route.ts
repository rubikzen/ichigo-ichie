import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!UUID_RE.test(token)) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  const supabase = createServiceSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });

  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,payment_method,payment_expires_at,order_type,pickup_time,subtotal,discount_amount,promo_code,shipping_fee,total,created_at,shipping_method_name,shipping_address1,shipping_address2,shipping_postal_code,shipping_city,shipping_country,package_weight_g,tracking_carrier,tracking_number,tracking_url,shipped_at,invoices(id,document_type,document_number),order_items(id,product_name,quantity,line_total,choices)")
    .maybeSingle();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Impossible de charger la commande." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
