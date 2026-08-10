import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

async function syncInvoiceEnvironment(supabase: any, orderIds: string[], environment: "test" | "live" | "legacy") {
  const chunkSize = 100;
  for (let index = 0; index < orderIds.length; index += chunkSize) {
    const chunk = orderIds.slice(index, index + chunkSize);
    if (!chunk.length) continue;
    const { data, error } = await supabase.from("invoices").select("id,document_number").in("order_id", chunk);
    if (error) {
      if (String(error.message || "").includes("invoices")) continue;
      throw error;
    }
    for (const invoice of data ?? []) {
      const number = String(invoice.document_number || "");
      const documentNumber = environment === "test" && number && !number.startsWith("TEST-") ? `TEST-${number}` : number;
      const { error: updateError } = await supabase.from("invoices").update({ environment, document_number: documentNumber }).eq("id", invoice.id);
      if (updateError) throw updateError;
    }
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = await request.json() as { action?: string; confirmation?: string };
    const action = String(body.action || "");
    const confirmation = String(body.confirmation || "").trim().toUpperCase();

    if (action === "mark_legacy_test") {
      if (confirmation !== "MARQUER TEST") return NextResponse.json({ error: "Confirmation incorrecte." }, { status: 400 });
      const { data: legacyRows, error: readError } = await supabase.from("orders").select("id").eq("environment", "legacy");
      if (readError) throw readError;
      const ids = (legacyRows ?? []).map((row: any) => row.id);
      if (ids.length) {
        const { error } = await supabase.from("orders").update({ environment: "test" }).in("id", ids);
        if (error) throw error;
        await syncInvoiceEnvironment(supabase, ids, "test");
      }
      return NextResponse.json({ ok: true, affected: ids.length, message: `${ids.length} commande(s) classée(s) en test.` });
    }

    if (action === "archive_test") {
      if (confirmation !== "ARCHIVER TEST") return NextResponse.json({ error: "Confirmation incorrecte." }, { status: 400 });
      const { data, error } = await supabase.from("orders")
        .update({ archived_at: new Date().toISOString() })
        .eq("environment", "test")
        .is("archived_at", null)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, affected: data?.length || 0, message: `${data?.length || 0} commande(s) test archivée(s).` });
    }

    if (action === "restore_test") {
      if (confirmation !== "RESTAURER TEST") return NextResponse.json({ error: "Confirmation incorrecte." }, { status: 400 });
      const { data, error } = await supabase.from("orders")
        .update({ archived_at: null })
        .eq("environment", "test")
        .not("archived_at", "is", null)
        .select("id");
      if (error) throw error;
      return NextResponse.json({ ok: true, affected: data?.length || 0, message: `${data?.length || 0} commande(s) test restaurée(s).` });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error: any) {
    const status = typeof error?.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error?.message || "Action impossible." }, { status });
  }
}
