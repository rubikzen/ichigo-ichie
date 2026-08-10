import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const errorDescription =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  const accountUrl = new URL("/compte", requestUrl.origin);

  if (errorDescription) {
    accountUrl.searchParams.set("auth_error", errorDescription);
    return NextResponse.redirect(accountUrl);
  }

  if (!code) {
    accountUrl.searchParams.set(
      "auth_error",
      "Lien de connexion invalide ou incomplet."
    );
    return NextResponse.redirect(accountUrl);
  }

  const supabase = await createServerSupabase();

  if (!supabase) {
    accountUrl.searchParams.set(
      "auth_error",
      "Supabase n'est pas configuré."
    );
    return NextResponse.redirect(accountUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase auth callback error:", error);

    accountUrl.searchParams.set(
      "auth_error",
      "Lien de connexion invalide ou expiré."
    );

    return NextResponse.redirect(accountUrl);
  }

  const { error: claimError } = await supabase.rpc(
    "claim_customer_orders"
  );

  if (claimError) {
    console.error("claim_customer_orders error:", claimError);
  }

  return NextResponse.redirect(accountUrl);
}