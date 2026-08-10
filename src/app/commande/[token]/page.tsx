import { OrderTracker } from "@/components/OrderTracker";

export default async function OrderTrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderTracker token={token} />;
}
