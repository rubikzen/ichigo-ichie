import { NextResponse } from "next/server";

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizedSuggestion(item: any, index: number) {
  const p = item?.properties ?? item ?? {};
  const label = firstText(
    p.fulltext,
    p.label,
    p.display_name,
    p.displayName,
    p.text,
    p.title,
    p.address,
    p.name,
  );

  let postalCode = firstText(p.zipcode, p.postcode, p.postalCode, p.postal_code, p.zip);
  let city = firstText(p.city, p.cityname, p.cityName, p.commune, p.municipality, p.locality);
  let address1 = firstText(p.street, p.streetName, p.address, p.name, label);

  if (!postalCode && label) postalCode = label.match(/\b\d{5}\b/)?.[0] ?? "";
  if (!city && postalCode && label) {
    const afterPostal = label.split(postalCode)[1]?.replace(/^[,\s-]+/, "").trim() ?? "";
    city = afterPostal.split(",")[0]?.trim() ?? "";
  }

  if (label && postalCode) {
    const beforePostal = label.split(postalCode)[0]?.replace(/[,\s-]+$/, "").trim() ?? "";
    if (beforePostal.length >= 3) address1 = beforePostal;
  } else if (label && city) {
    const cityIndex = label.toLocaleLowerCase("fr-FR").lastIndexOf(city.toLocaleLowerCase("fr-FR"));
    if (cityIndex > 2) address1 = label.slice(0, cityIndex).replace(/[,\s-]+$/, "").trim();
  }

  if (!label && !address1) return null;
  return {
    id: firstText(p.banID, p.id, item?.id) || `${index}-${label || address1}`,
    label: label || [address1, postalCode, city].filter(Boolean).join(", "),
    address1: address1 || label,
    postalCode,
    city,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().slice(0, 160);
  if (q.length < 3) return NextResponse.json({ suggestions: [] });

  const params = new URLSearchParams({
    text: q,
    terr: "METROPOLE",
    type: "StreetAddress",
    maximumResponses: "6",
  });

  try {
    const response = await fetch(`https://data.geopf.fr/geocodage/completion/?${params.toString()}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ suggestions: [] });
    const data = await response.json();
    const source = Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data?.features)
          ? data.features
          : Array.isArray(data?.suggestions)
            ? data.suggestions
            : [];
    const suggestions = source.map(normalizedSuggestion).filter(Boolean).slice(0, 6);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
