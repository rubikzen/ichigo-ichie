import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { ensureInvoiceForOrder, generateInvoicePdf, loadInvoiceDocument } from "@/lib/invoice";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    const supabase = createServiceSupabase();
    if (!supabase) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
    const url = new URL(request.url);
    const requestedType = url.searchParams.get("type") === "credit_note" ? "credit_note" : "invoice";
    const publicToken = url.searchParams.get("token")?.trim() || "";
    const authorization = request.headers.get("authorization") || "";
    const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,public_token,customer_id,payment_status")
      .eq("id", orderId)
      .single();
    if (orderError || !order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    let authorized = Boolean(publicToken && order.public_token && publicToken === order.public_token);
    if (!authorized && bearer) {
      const { data: userData } = await supabase.auth.getUser(bearer);
      if (userData.user) {
        if (order.customer_id === userData.user.id) authorized = true;
        else {
          const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", userData.user.id).maybeSingle();
          authorized = Boolean(admin);
        }
      }
    }
    if (!authorized) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

    let document = await loadInvoiceDocument(supabase, orderId, requestedType);
    if (!document && requestedType === "invoice") document = await ensureInvoiceForOrder(supabase, orderId);
    if (!document) return NextResponse.json({ error: requestedType === "credit_note" ? "Avoir indisponible." : "Facture indisponible." }, { status: 404 });

    const pdf = await generateInvoicePdf(document, order.order_number);
    await supabase.from("invoices").update({ pdf_generated_at: new Date().toISOString() }).eq("id", document.id);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.document_number}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Invoice PDF error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Facture indisponible." }, { status: 500 });
  }
}
