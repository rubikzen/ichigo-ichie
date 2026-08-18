import { NextResponse } from "next/server";
import { requirePickupStaff } from "@/lib/admin-auth";

export async function GET(request: Request) {
  try {
    const { access } = await requirePickupStaff(request);
    return NextResponse.json(
      { ok: true, access },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status =
      typeof (error as { status?: unknown })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Accès refusé." },
      { status }
    );
  }
}
