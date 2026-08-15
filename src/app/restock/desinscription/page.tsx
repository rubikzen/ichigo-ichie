import type { Metadata } from "next";
import { RestockUnsubscribeClient } from "@/components/RestockUnsubscribeClient";

export const metadata: Metadata = {
  title: "Gérer une alerte de retour en stock",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function RestockUnsubscribePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <RestockUnsubscribeClient
      subscriptionId={first(params.id).trim()}
      token={first(params.token).trim()}
      language={first(params.lang) === "en" ? "en" : "fr"}
    />
  );
}
