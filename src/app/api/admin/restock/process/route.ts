import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { processRestockNotificationsForProduct } from "@/lib/restock-notifications";

// Product IDs are stored in PostgreSQL UUID columns. Accept the canonical UUID
// shape without restricting the UUID version nibble; the database remains the
// source of truth for whether the identifier exists and belongs to a product.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const productId = String(body.productId || "").trim();

    if (!UUID_RE.test(productId)) {
      return NextResponse.json(
        { error: "Produit invalide." },
        { status: 400 },
      );
    }

    const result = await processRestockNotificationsForProduct(
      supabase,
      productId,
    );

    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? Number((error as { status: number }).status)
        : 500;

    console.error("Admin restock processing error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Traitement des alertes impossible.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
