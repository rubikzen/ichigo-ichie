import { MatchaIntentPageServer } from "@/components/MatchaIntentPageServer";
import { getMatchaIntentMetadata } from "@/lib/matcha-intent-pages";
import { getSiteSettings } from "@/lib/settings";

export const revalidate = 30;
export async function generateMetadata() {
  const settings = await getSiteSettings();
  return getMatchaIntentMetadata("koicha", settings);
}

export default function Page() {
  return <MatchaIntentPageServer tag="koicha" />;
}
