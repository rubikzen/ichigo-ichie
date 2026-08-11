import { unstable_cache } from "next/cache";
import { getCatalog, type CatalogKind } from "@/lib/catalog";

const getCachedCatalogInternal = unstable_cache(
  async (kind: CatalogKind) => getCatalog(kind),
  ["ichigo-catalog-v263"],
  { revalidate: 30, tags: ["catalog"] },
);

export async function getCachedCatalog(kind: CatalogKind) {
  return getCachedCatalogInternal(kind);
}
