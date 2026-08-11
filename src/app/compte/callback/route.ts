import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");

  const errorDescription =
    requestUrl.searchParams.get("error_description") ||
    requestUrl.searchParams.get("error");

  const accountUrl = new URL("/compte", requestUrl.origin);

  if (errorDescription) {
    accountUrl.searchParams.set("auth_error", errorDescription);
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

  let authError: Error | null = null;
  let isRecovery = false;

  /*
   * Flow token_hash :
   * signup / magic link / recovery
   */
  if (tokenHash && type) {
    isRecovery = type === "recovery";

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });

    authError = error;
  }

  /*
   * Flow PKCE classique
   */
  else if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    authError = error;

    /*
     * Pour un reset password utilisant ?code=,
     * on conserve l'information via ?next=reset
     */
    isRecovery =
      requestUrl.searchParams.get("next") === "reset" ||
      requestUrl.searchParams.get("recovery") === "1";
  }

  /*
   * Aucun token reconnu
   */
  else {
    accountUrl.searchParams.set(
      "auth_error",
      "Lien de connexion invalide ou incomplet."
    );

    return NextResponse.redirect(accountUrl);
  }

  if (authError) {
    console.error("Supabase auth callback error:", authError);

    accountUrl.searchParams.set(
      "auth_error",
      "Lien de connexion invalide ou expiré."
    );

    return NextResponse.redirect(accountUrl);
  }

  /*
   * Rattache les anciennes commandes
   */
  const { error: claimError } = await supabase.rpc(
    "claim_customer_orders"
  );

  if (claimError) {
    console.error(
      "claim_customer_orders error:",
      claimError
    );
  }

  /*
   * Reset password :
   * session créée, puis affichage du formulaire
   * permettant de choisir le nouveau mot de passe.
   */
  if (isRecovery) {
    const resetUrl = new URL("/compte", requestUrl.origin);
    resetUrl.searchParams.set("reset_password", "1");

    return NextResponse.redirect(resetUrl);
  }

  return NextResponse.redirect(accountUrl);
}