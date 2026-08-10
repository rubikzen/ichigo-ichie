import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postalCode = String(url.searchParams.get("postalCode") || "").replace(/\D/g, "").slice(0, 5);
  if (!/^\d{5}$/.test(postalCode) || /^(97|98)/.test(postalCode)) return NextResponse.json({ cities: [] });

  const params = new URLSearchParams({
    codePostal: postalCode,
    fields: "nom,codesPostaux",
    format: "json",
  });

  try {
    const response = await fetch(`https://geo.api.gouv.fr/communes?${params.toString()}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ cities: [] });
    const data = await response.json();
    const names = Array.isArray(data)
      ? [...new Set(data.map((row: any) => String(row?.nom || "").trim()).filter(Boolean))]
      : [];
    return NextResponse.json({ cities: names.map((name) => ({ name })) });
  } catch {
    return NextResponse.json({ cities: [] });
  }
}
