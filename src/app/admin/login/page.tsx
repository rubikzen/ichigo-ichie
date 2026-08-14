"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SafeImage } from "@/components/SafeImage";
import { createBrowserSupabase, isSupabaseConfigured } from "@/lib/supabase/browser";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createBrowserSupabase();
    if (!supabase) return setError("Supabase chưa được cấu hình. Xem README.md.");
    setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: String(form.get("email") || ""), password: String(form.get("password") || "") });
    setLoading(false);
    if (authError) return setError(authError.message);
    router.replace("/admin"); router.refresh();
  }

  return <section className="admin-login-page"><div className="admin-login-card"><SafeImage src="/brand-mark.svg" alt="" width={58} height={58} sizes="58px" priority /><p className="eyebrow">ESPACE PRIVÉ</p><h1>Administration</h1><p>Gérez les produits, le menu, les images et les commandes.</p>
    {!isSupabaseConfigured() && <div className="setup-warning"><strong>Configuration nécessaire</strong><p>Ajoutez les variables Supabase dans <code>.env.local</code>, puis exécutez le fichier SQL fourni.</p></div>}
    <form onSubmit={submit}><label>Email<input type="email" name="email" required autoComplete="email" /></label><label>Mot de passe<input type="password" name="password" required autoComplete="current-password" /></label>{error && <p className="form-error">{error}</p>}<button className="button primary full" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button></form>
    <Link href="/">← Retour au site</Link>
  </div></section>;
}
