"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function CustomerAuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) { setError("Supabase n’est pas configuré."); return; }
    let active = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const urlError = params.get("error_description") || params.get("error");
      if (urlError) { if (active) setError(urlError); return; }
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) { if (active) setError(exchangeError.message); return; }
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) { if (active) setError("Lien de connexion invalide ou expiré."); return; }
      await supabase.rpc("claim_customer_orders");
      window.location.replace("/compte");
    })();
    return () => { active = false; };
  }, []);

  return <section className="customer-account-page-v243 customer-auth-page-v243"><div className="customer-auth-card-v243"><p className="eyebrow">ICHIGO ICHIE</p>{error ? <><h1>Connexion impossible</h1><p className="form-error">{error}</p><Link className="button primary" href="/compte">Réessayer</Link></> : <><h1>Connexion sécurisée</h1><p>Vérification de votre e-mail et récupération de vos commandes…</p><div className="customer-auth-loader-v243" aria-hidden="true" /></>}</div></section>;
}
