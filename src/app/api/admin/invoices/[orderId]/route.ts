import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { ensureCreditNoteForOrder, ensureInvoiceForOrder, sendInvoiceDocumentEmail } from "@/lib/invoice";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    const { orderId } = await context.params;
    if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    const { supabase } = await requireAdmin(request);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "issue");
    const { data: order, error: orderError } = await supabase.from("orders").select("id,order_number,public_token,customer_email,customer_first_name,payment_status,status").eq("id", orderId).single();
    if (orderError || !order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });

    if (action === "credit_note") {
      if (order.payment_status !== "refunded") return NextResponse.json({ error: "L’avoir est disponible après confirmation du remboursement." }, { status: 409 });
      const document = await ensureCreditNoteForOrder(supabase, orderId, { force: true });
      if (!document) throw new Error("Avoir impossible à créer.");
      return NextResponse.json({ ok: true, document });
    }

    const document = await ensureInvoiceForOrder(supabase, orderId, { force: true });
    if (!document) throw new Error("Facture impossible à créer.");
    if (action === "email") await sendInvoiceDocumentEmail(supabase, document, order);
    return NextResponse.json({ ok: true, document });
  } catch (error) {
    const status = typeof (error as any)?.status === "number" ? (error as any).status : String((error as Error)?.message || "").startsWith("INVOICE_") ? 409 : 500;
    console.error("Admin invoice action error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Action facture impossible." }, { status });
  }
}
