import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set(["pending", "approved", "hidden"]);

function clean(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

export async function GET(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const url = new URL(request.url);
    const status = clean(url.searchParams.get("status"), 20) || "pending";

    let query = supabase
      .from("product_reviews")
      .select(
        "id,product_id,order_id,author_name,rating,title,body,status,admin_reply,admin_replied_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (status !== "all") {
      if (!STATUSES.has(status)) {
        return NextResponse.json(
          { error: "Filtre invalide." },
          { status: 400 },
        );
      }
      query = query.eq("status", status);
    }

    const { data: reviews, error } = await query;
    if (error) throw error;

    const productIds = [
      ...new Set(
        (reviews ?? [])
          .map((row) => String(row.product_id || ""))
          .filter(Boolean),
      ),
    ];

    const productNames = new Map<string, string>();
    if (productIds.length) {
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,name_fr")
        .in("id", productIds);

      if (productError) throw productError;
      for (const product of products ?? []) {
        productNames.set(
          String(product.id),
          String(product.name_fr || "Produit"),
        );
      }
    }

    return NextResponse.json(
      {
        reviews: (reviews ?? []).map((row) => ({
          id: String(row.id),
          productId: String(row.product_id),
          productName:
            productNames.get(String(row.product_id)) || "Produit",
          authorName: String(row.author_name || "Client vérifié"),
          rating: Number(row.rating),
          title: row.title ? String(row.title) : null,
          body: String(row.body || ""),
          status: String(row.status),
          adminReply: row.admin_reply ? String(row.admin_reply) : "",
          adminRepliedAt: row.admin_replied_at
            ? String(row.admin_replied_at)
            : null,
          createdAt: String(row.created_at),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin review lookup failed", error);
    return NextResponse.json(
      { error: "Impossible de charger les avis." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireAdmin(request);
    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const id = clean(body.id, 64);
    const status =
      body.status == null ? null : clean(body.status, 20);
    const adminReply =
      body.adminReply == null ? null : clean(body.adminReply, 2000);

    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Avis invalide." },
        { status: 400 },
      );
    }

    if (status !== null && !STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Statut invalide." },
        { status: 400 },
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status !== null) patch.status = status;

    if (body.adminReply !== undefined) {
      patch.admin_reply = adminReply || null;
      patch.admin_replied_at = adminReply
        ? new Date().toISOString()
        : null;
    }

    const { data, error } = await supabase
      .from("product_reviews")
      .update(patch)
      .eq("id", id)
      .select("id,status,admin_reply,admin_replied_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Avis introuvable." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { ok: true, review: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Admin review moderation failed", error);
    return NextResponse.json(
      { error: "Modification impossible." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
