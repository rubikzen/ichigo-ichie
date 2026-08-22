import { MatchaIntentPageServer } from "@/components/MatchaIntentPageServer";
import { getMatchaIntentMetadata } from "@/lib/matcha-intent-pages";

export const revalidate = 30;
export const metadata = getMatchaIntentMetadata("latte");

export default function Page() {
  return <MatchaIntentPageServer tag="latte" />;
}
