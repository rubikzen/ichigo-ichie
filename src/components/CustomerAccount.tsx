"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { useLanguage } from "@/components/LanguageProvider";

type Profile = {
  first_name: string;
  last_name: string;
  phone: string;
};

type Address = {
  id: string;
  label: string;
  address1: string;
  address2: string | null;
  postal_code: string;
  city: string;
  country: string;
  is_default: boolean;
};

type CustomerOrder = {
  id: string;
  order_number: string;
  public_token: string | null;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled" | "refunded";
  payment_status: string;
  order_type: "pickup" | "shipping";
  total: number;
  created_at: string;
  shipping_method_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  invoices?: Array<{ id: string; document_type: "invoice" | "credit_note"; document_number: string }>;
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    line_total: number;
    variant_id?: string | null;
    choices?: Array<{ label?: string }>;
    variant?: { id: string; name: string; packaging: string | null; weight: string | null } | null;
  }>;
};

type Tab = "orders" | "profile" | "addresses";
type OrderFilter = "all" | "payment" | "active" | "completed" | "cancelled" | "refunded";

const blankAddress = { label: "Maison", address1: "", address2: "", postal_code: "", city: "", country: "FR", is_default: false };

export function CustomerAccount() {
  const { language } = useLanguage();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [authSuccess, setAuthSuccess] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [tab, setTab] = useState<Tab>("orders");
  const [profile, setProfile] = useState<Profile>({ first_name: "", last_name: "", phone: "" });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("active");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState(blankAddress);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const money = useMemo(() => new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-GB", { style: "currency", currency: "EUR" }), [language]);

  const orderStats = useMemo(() => {
    const stats = { payment: 0, active: 0, completed: 0, cancelled: 0, refunded: 0 };
    for (const order of orders) stats[orderBucket(order)] += 1;
    return stats;
  }, [orders]);

  const effectiveOrderFilter: OrderFilter =
    !loading && user && orders.length > 0 && orderFilter === "active" && orderStats.active === 0
      ? (orderStats.payment > 0 ? "payment" : "all")
      : orderFilter;

  const visibleOrders = useMemo(() => {
    if (effectiveOrderFilter === "all") return orders;
    return orders.filter((order) => orderBucket(order) === effectiveOrderFilter);
  }, [orders, effectiveOrderFilter]);

  const loadAccount = useCallback(async (authUser: User) => {
    if (!supabase) return;
    await supabase.rpc("claim_customer_orders");
    const [profileResult, addressResult, orderResult] = await Promise.all([
      supabase.from("customer_profiles").select("first_name,last_name,phone").eq("id", authUser.id).maybeSingle(),
      supabase.from("customer_addresses").select("id,label,address1,address2,postal_code,city,country,is_default").eq("customer_id", authUser.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("orders")
        .select("id,order_number,public_token,status,payment_status,order_type,total,created_at,shipping_method_name,tracking_number,tracking_url,invoices(id,document_type,document_number),order_items(id,product_name,quantity,line_total,variant_id,choices)")
        .eq("customer_id", authUser.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
    ]);
    if (profileResult.data) setProfile({
      first_name: String(profileResult.data.first_name || ""),
      last_name: String(profileResult.data.last_name || ""),
      phone: String(profileResult.data.phone || ""),
    });
    setAddresses((addressResult.data ?? []) as Address[]);

    const rawOrders = (orderResult.data ?? []) as CustomerOrder[];
    const variantIds = Array.from(new Set(rawOrders.flatMap((order) => (order.order_items ?? []).map((item) => item.variant_id).filter(Boolean) as string[])));
    const variantMap = new Map<string, { id: string; name: string; packaging: string | null; weight: string | null }>();
    if (variantIds.length) {
      const { data: variantRows } = await supabase.from("product_variants").select("id,name,packaging,weight").in("id", variantIds);
      for (const row of variantRows ?? []) variantMap.set(row.id, row);
    }
    setOrders(rawOrders.map((order) => ({
      ...order,
      order_items: (order.order_items ?? []).map((item) => ({ ...item, variant: item.variant_id ? variantMap.get(item.variant_id) ?? null : null })),
    })));
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset_password") === "1") setResetPasswordMode(true);

      const callbackError = params.get("auth_error");
      if (callbackError) setAuthError(callbackError);
    });

    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      setUser(data.user);
      if (data.user) await loadAccount(data.user);
      if (active) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;

      if (event === "PASSWORD_RECOVERY") {
        setResetPasswordMode(true);
        setAuthError("");
        setAuthSuccess("");
      }

      setUser(session?.user ?? null);
      if (session?.user) void loadAccount(session.user);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase, loadAccount]);

  async function loginWithPassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;

    setAuthError("");
    setAuthSuccess("");
    setSaving(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    setSaving(false);

    if (error) {
      setAuthError(
        language === "fr"
          ? "E-mail ou mot de passe incorrect."
          : "Incorrect email or password."
      );
    }
  }

  async function registerWithPassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim() || !password) return;

    setAuthError("");
    setAuthSuccess("");

    if (password.length < 8) {
      setAuthError(
        language === "fr"
          ? "Le mot de passe doit contenir au moins 8 caractères."
          : "Password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setAuthError(
        language === "fr"
          ? "Les mots de passe ne correspondent pas."
          : "Passwords do not match."
      );
      return;
    }

    setSaving(true);

    const redirectTo = `${window.location.origin}/compte/callback`;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    setSaving(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (data.session) {
      setAuthSuccess(
        language === "fr"
          ? "Votre compte a été créé avec succès."
          : "Your account has been created successfully."
      );
      return;
    }

    setAuthSuccess(
      language === "fr"
        ? "Compte créé. Consultez votre boîte mail pour confirmer votre adresse e-mail."
        : "Account created. Check your inbox to confirm your email address."
    );
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !email.trim()) return;

    setAuthError("");
    setAuthSuccess("");
    setSaving(true);

    const redirectTo = `${window.location.origin}/compte/callback?next=reset`;

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo }
    );

    setSaving(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setAuthSuccess(
  language === "fr"
    ? "Si un compte est associé à cette adresse e-mail, vous recevrez un lien de réinitialisation."
    : "If an account is associated with this email address, you will receive a password reset link."
);
  }

  async function updateRecoveredPassword(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;

    setAuthError("");
    setAuthSuccess("");

    if (newPassword.length < 8) {
      setAuthError(
        language === "fr"
          ? "Le nouveau mot de passe doit contenir au moins 8 caractères."
          : "The new password must contain at least 8 characters."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setAuthError(
        language === "fr"
          ? "Les mots de passe ne correspondent pas."
          : "Passwords do not match."
      );
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    setNewPassword("");
    setConfirmNewPassword("");
    setResetPasswordMode(false);
    setNotice(
      language === "fr"
        ? "Votre mot de passe a été mis à jour ✓"
        : "Your password has been updated ✓"
    );

    const url = new URL(window.location.href);
    url.searchParams.delete("reset_password");
    url.searchParams.delete("auth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving(true); setNotice("");
    const { error } = await supabase.from("customer_profiles").upsert({
      id: user.id,
      first_name: profile.first_name.trim(),
      last_name: profile.last_name.trim(),
      phone: profile.phone.trim(),
    });
    setSaving(false);
    setNotice(error ? error.message : (language === "fr" ? "Informations enregistrées ✓" : "Details saved ✓"));
  }

  async function saveAddress(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving(true); setNotice("");
    const payload = {
      customer_id: user.id,
      label: addressDraft.label.trim() || (language === "fr" ? "Adresse" : "Address"),
      address1: addressDraft.address1.trim(),
      address2: addressDraft.address2.trim() || null,
      postal_code: addressDraft.postal_code.replace(/\D/g, "").slice(0, 5),
      city: addressDraft.city.trim(),
      country: "FR",
      is_default: addressDraft.is_default || addresses.length === 0,
    };
    if (payload.is_default) await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_id", user.id);
    const result = editingAddressId
      ? await supabase.from("customer_addresses").update(payload).eq("id", editingAddressId).eq("customer_id", user.id)
      : await supabase.from("customer_addresses").insert(payload);
    setSaving(false);
    if (result.error) return setNotice(result.error.message);
    setAddressDraft(blankAddress); setEditingAddressId(null);
    setNotice(language === "fr" ? "Adresse enregistrée ✓" : "Address saved ✓");
    await loadAccount(user);
  }

  function editAddress(address: Address) {
    setEditingAddressId(address.id);
    setAddressDraft({ label: address.label, address1: address.address1, address2: address.address2 || "", postal_code: address.postal_code, city: address.city, country: address.country, is_default: address.is_default });
    setTab("addresses");
    requestAnimationFrame(() => document.getElementById("customer-address-form-v243")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  async function deleteAddress(id: string) {
    if (!supabase || !user || !window.confirm(language === "fr" ? "Supprimer cette adresse ?" : "Delete this address?")) return;
    await supabase.from("customer_addresses").delete().eq("id", id).eq("customer_id", user.id);
    await loadAccount(user);
  }

  function canPayOrder(order: CustomerOrder) {
    return (
      Boolean(order.public_token) &&
      !["cancelled", "refunded"].includes(order.status) &&
      ["pending", "unpaid", "failed", "expired"].includes(order.payment_status)
    );
  }

  function canCancelUnpaidOrder(order: CustomerOrder) {
    return (
      Boolean(order.public_token) &&
      !["cancelled", "refunded", "preparing", "ready", "completed"].includes(order.status) &&
      !["paid", "refunded", "refund_pending", "refund_failed"].includes(order.payment_status)
    );
  }

  async function cancelUnpaidOrder(order: CustomerOrder) {
    if (!order.public_token || !canCancelUnpaidOrder(order)) return;

    const confirmed = window.confirm(
      language === "fr"
        ? `Annuler la commande ${order.order_number} ?\n\nLe paiement sera fermé et les articles réservés seront libérés.`
        : `Cancel order ${order.order_number}?\n\nThe payment will be closed and reserved items will be released.`
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(order.public_token)}/cancel`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Annulation impossible.");

      setNotice(
        language === "fr"
          ? `Commande ${order.order_number} annulée.`
          : `Order ${order.order_number} cancelled.`
      );
      if (user) await loadAccount(user);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : (language === "fr" ? "Annulation impossible." : "Unable to cancel order.")
      );
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setOrders([]); setAddresses([]);
  }

  if (!supabase) return <section className="customer-account-page-v243"><div className="customer-auth-card-v243"><h1>Mon compte</h1><p>Supabase n’est pas configuré.</p></div></section>;
  if (loading) return <section className="customer-account-page-v243"><div className="customer-account-loading-v243">{language === "fr" ? "Chargement de votre espace…" : "Loading your account…"}</div></section>;

  if (resetPasswordMode && user) return <section className="customer-account-page-v243 customer-auth-page-v243">
    <div className="customer-auth-card-v243">
      <p className="eyebrow">ICHIGO ICHIE</p>
      <h1>{language === "fr" ? "Nouveau mot de passe" : "New password"}</h1>
      <p>
        {language === "fr"
          ? "Choisissez un nouveau mot de passe pour votre espace client."
          : "Choose a new password for your customer account."}
      </p>

      <form onSubmit={updateRecoveredPassword} className="customer-auth-form-v243">
        <label>
          {language === "fr" ? "Nouveau mot de passe" : "New password"}
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <label>
          {language === "fr" ? "Confirmer le mot de passe" : "Confirm password"}
          <input
            type="password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>

        <small>
          {language === "fr"
            ? "8 caractères minimum."
            : "Minimum 8 characters."}
        </small>

        <button className="button primary full" disabled={saving}>
          {saving
            ? "…"
            : (language === "fr" ? "Enregistrer le nouveau mot de passe" : "Save new password")}
        </button>
      </form>

      {authError && <p className="form-error">{authError}</p>}
    </div>
  </section>;

  if (!user) return <section className="customer-account-page-v243 customer-auth-page-v243">
    <div className="customer-auth-card-v243">
      <p className="eyebrow">ICHIGO ICHIE</p>

      <h1>
        {authMode === "login"
          ? (language === "fr" ? "Mon espace client" : "My account")
          : authMode === "register"
            ? (language === "fr" ? "Créer mon compte" : "Create my account")
            : (language === "fr" ? "Mot de passe oublié" : "Forgot password")}
      </h1>

      <p>
        {authMode === "login"
          ? (language === "fr"
              ? "Connectez-vous pour retrouver vos commandes, vos adresses et le suivi de vos colis."
              : "Sign in to find your orders, addresses and parcel tracking.")
          : authMode === "register"
            ? (language === "fr"
                ? "Créez votre espace client Ichigo Ichie."
                : "Create your Ichigo Ichie customer account.")
            : (language === "fr"
                ? "Indiquez votre adresse e-mail pour réinitialiser votre mot de passe."
                : "Enter your email address to reset your password.")}
      </p>

      {authMode === "login" && (
        <form onSubmit={loginWithPassword} className="customer-auth-form-v243">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="vous@exemple.fr"
              required
            />
          </label>

          <label>
            {language === "fr" ? "Mot de passe" : "Password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          <button className="button primary full" disabled={saving}>
            {saving ? "…" : (language === "fr" ? "Se connecter" : "Sign in")}
          </button>

          <button
            type="button"
            className="customer-auth-text-button-v246"
            onClick={() => {
              setAuthMode("forgot");
              setAuthError("");
              setAuthSuccess("");
            }}
          >
            {language === "fr" ? "Mot de passe oublié ?" : "Forgot password?"}
          </button>

          <div className="customer-auth-divider-v246">
            <span>{language === "fr" ? "Nouveau chez Ichigo Ichie ?" : "New to Ichigo Ichie?"}</span>
          </div>

          <button
            type="button"
            className="button ghost full"
            onClick={() => {
              setAuthMode("register");
              setAuthError("");
              setAuthSuccess("");
              setPassword("");
            }}
          >
            {language === "fr" ? "Créer un compte" : "Create an account"}
          </button>
        </form>
      )}

      {authMode === "register" && (
        <form onSubmit={registerWithPassword} className="customer-auth-form-v243">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="vous@exemple.fr"
              required
            />
          </label>

          <label>
            {language === "fr" ? "Mot de passe" : "Password"}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label>
            {language === "fr" ? "Confirmer le mot de passe" : "Confirm password"}
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <small>
            {language === "fr"
              ? "8 caractères minimum."
              : "Minimum 8 characters."}
          </small>

          <button className="button primary full" disabled={saving}>
            {saving ? "…" : (language === "fr" ? "Créer mon compte" : "Create my account")}
          </button>

          <button
            type="button"
            className="customer-auth-text-button-v246"
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
              setAuthSuccess("");
              setPassword("");
              setConfirmPassword("");
            }}
          >
            ← {language === "fr" ? "Déjà un compte ? Se connecter" : "Already have an account? Sign in"}
          </button>
        </form>
      )}

      {authMode === "forgot" && (
        <form onSubmit={resetPassword} className="customer-auth-form-v243">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="vous@exemple.fr"
              required
            />
          </label>

          <button className="button primary full" disabled={saving}>
            {saving ? "…" : (language === "fr" ? "Réinitialiser mon mot de passe" : "Reset password")}
          </button>

          <button
            type="button"
            className="customer-auth-text-button-v246"
            onClick={() => {
              setAuthMode("login");
              setAuthError("");
              setAuthSuccess("");
            }}
          >
            ← {language === "fr" ? "Retour à la connexion" : "Back to sign in"}
          </button>
        </form>
      )}

      {authSuccess && (
        <div className="customer-auth-success-v246">
          <span>✓</span>
          <p>{authSuccess}</p>
        </div>
      )}

      {authError && <p className="form-error">{authError}</p>}

      <Link href="/#boutique" className="customer-back-link-v243">
        ← {language === "fr" ? "Retour à la boutique" : "Back to shop"}
      </Link>
    </div>
  </section>;

  return <section className="customer-account-page-v243">
    <div className="customer-account-shell-v243">
      <header className="customer-account-head-v243">
        <div><p className="eyebrow">{language === "fr" ? "ESPACE CLIENT" : "CUSTOMER ACCOUNT"}</p><h1>{profile.first_name ? `${language === "fr" ? "Bonjour" : "Hello"} ${profile.first_name}` : (language === "fr" ? "Mon compte" : "My account")}</h1><p>{user.email}</p></div>
        <button type="button" className="button ghost" onClick={logout}>{language === "fr" ? "Se déconnecter" : "Sign out"}</button>
      </header>

      <nav className="customer-account-tabs-v243" aria-label={language === "fr" ? "Espace client" : "Customer account"}>
        <button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>{language === "fr" ? "Mes commandes" : "My orders"}<span>{orders.length}</span></button>
        <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>{language === "fr" ? "Mes informations" : "My details"}</button>
        <button className={tab === "addresses" ? "active" : ""} onClick={() => setTab("addresses")}>{language === "fr" ? "Mes adresses" : "My addresses"}<span>{addresses.length}</span></button>
      </nav>

      {notice && <div className="customer-notice-v243">{notice}</div>}

      {tab === "orders" && <div className="customer-orders-v243 customer-orders-v244">
        <div className="customer-section-heading-v243 customer-section-heading-v244"><div><p className="eyebrow">{language === "fr" ? "HISTORIQUE" : "HISTORY"}</p><h2>{language === "fr" ? "Mes commandes" : "My orders"}</h2></div><Link href="/#boutique" className="button ghost">{language === "fr" ? "Retour à la boutique" : "Back to shop"}</Link></div>

        {!!orders.length && <>
          <div className="customer-order-summary-v244" aria-label={language === "fr" ? "Résumé des commandes" : "Order summary"}>
            <button type="button" onClick={() => setOrderFilter("payment")} className={effectiveOrderFilter === "payment" ? "active" : ""}><span>{orderStats.payment}</span><small>{language === "fr" ? "Paiement" : "Payment"}</small></button>
            <button type="button" onClick={() => setOrderFilter("active")} className={effectiveOrderFilter === "active" ? "active" : ""}><span>{orderStats.active}</span><small>{language === "fr" ? "En cours" : "In progress"}</small></button>
            <button type="button" onClick={() => setOrderFilter("completed")} className={effectiveOrderFilter === "completed" ? "active" : ""}><span>{orderStats.completed}</span><small>{language === "fr" ? "Terminées" : "Completed"}</small></button>
            <button type="button" onClick={() => setOrderFilter("cancelled")} className={effectiveOrderFilter === "cancelled" ? "active" : ""}><span>{orderStats.cancelled}</span><small>{language === "fr" ? "Annulées" : "Cancelled"}</small></button>
            {orderStats.refunded > 0 && <button type="button" onClick={() => setOrderFilter("refunded")} className={effectiveOrderFilter === "refunded" ? "active" : ""}><span>{orderStats.refunded}</span><small>{language === "fr" ? "Remboursées" : "Refunded"}</small></button>}
          </div>

          <div className="customer-order-filters-v244" role="tablist" aria-label={language === "fr" ? "Filtrer les commandes" : "Filter orders"}>
            {([
              ["all", language === "fr" ? "Toutes" : "All"],
              ["payment", language === "fr" ? "Paiement" : "Payment"],
              ["active", language === "fr" ? "En cours" : "In progress"],
              ["completed", language === "fr" ? "Terminées" : "Completed"],
              ["cancelled", language === "fr" ? "Annulées" : "Cancelled"],
              ...(orderStats.refunded > 0 ? [["refunded", language === "fr" ? "Remboursées" : "Refunded"]] : []),
            ] as Array<[OrderFilter, string]>).map(([value, label]) => <button type="button" role="tab" aria-selected={effectiveOrderFilter === value} key={value} className={effectiveOrderFilter === value ? "active" : ""} onClick={() => setOrderFilter(value)}>{label}{value !== "all" && <span>{orderStats[value]}</span>}</button>)}
          </div>
        </>}

        {!orders.length ? <div className="customer-empty-v243"><strong>{language === "fr" ? "Aucune commande pour le moment" : "No orders yet"}</strong><p>{language === "fr" ? "Les commandes passées avec cette adresse e-mail apparaîtront automatiquement ici." : "Orders placed with this email address will automatically appear here."}</p><Link className="button primary" href="/#boutique">Boutique</Link></div>
        : !visibleOrders.length ? <div className="customer-empty-v243 customer-empty-compact-v244"><strong>{language === "fr" ? "Aucune commande dans cette catégorie" : "No orders in this category"}</strong><button type="button" className="button ghost" onClick={() => setOrderFilter("all")}>{language === "fr" ? "Voir toutes les commandes" : "View all orders"}</button></div>
        : visibleOrders.map((order) => {
          const visual = orderVisualState(order);
          const expanded = expandedOrderId === order.id;
          const previewItems = (order.order_items ?? []).slice(0, expanded ? undefined : 2);
          const paymentHint = customerPaymentRecoveryHint(order, language);
          return <article key={order.id} className={`customer-order-card-v243 customer-order-card-v244 state-${visual}`}>
            <div className="customer-order-top-v243 customer-order-top-v244"><div><span>{new Date(order.created_at).toLocaleDateString(language === "fr" ? "fr-FR" : "en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span><h3>{order.order_number}</h3></div><div><span className={`customer-state-badge-v244 ${visual}`}>{orderBadgeLabel(order, language)}</span><strong>{money.format(Number(order.total))}</strong></div></div>

            <div className="customer-order-progress-v243 customer-order-progress-v244"><span className={`customer-order-state-v244 ${visual}`}>{customerStatusLabel(order, language)}</span><small>{order.order_type === "shipping" ? (order.shipping_method_name || (language === "fr" ? "Livraison" : "Shipping")) : (language === "fr" ? "Retrait boutique" : "Boutique pickup")}</small>{order.tracking_number && <small className="customer-tracking-number-v244">{order.tracking_number}</small>}{paymentHint && <small className="customer-payment-recovery-hint-v409">{paymentHint}</small>}</div>

            <div className={`customer-order-items-v243 customer-order-items-v244 ${expanded ? "expanded" : ""}`}>{previewItems.map((item) => <div key={item.id}><span><strong>{item.quantity} × {formatOrderItem(item, language)}</strong>{choiceSummary(item, language) ? <small>{choiceSummary(item, language)}</small> : null}</span><strong>{money.format(Number(item.line_total))}</strong></div>)}{!expanded && (order.order_items?.length || 0) > 2 && <small>+ {(order.order_items?.length || 0) - 2} {language === "fr" ? "article(s)" : "item(s)"}</small>}</div>

            <div className="customer-order-actions-v243 customer-order-actions-v244">
              <button type="button" className="button ghost" aria-expanded={expanded} onClick={() => setExpandedOrderId(expanded ? null : order.id)}>{expanded ? (language === "fr" ? "Réduire" : "Collapse") : (language === "fr" ? "Voir le détail" : "View details")}</button>
              {canPayOrder(order) && order.public_token ? (
                <Link
                  className="button primary"
                  href={`/commande/${order.public_token}?payment=retry`}
                >
                  {customerPaymentActionLabel(order, language)}
                </Link>
              ) : order.public_token ? (
                <Link className="button primary" href={`/commande/${order.public_token}`}>
                  {isActiveOrder(order)
                    ? (language === "fr" ? "Suivre ma commande" : "Track order")
                    : (language === "fr" ? "Voir la commande" : "View order")}
                </Link>
              ) : null}
              {canCancelUnpaidOrder(order) && (
                <button
                  type="button"
                  className="button ghost customer-cancel-order-v361"
                  disabled={saving}
                  onClick={() => void cancelUnpaidOrder(order)}
                >
                  {language === "fr" ? "Annuler" : "Cancel"}
                </button>
              )}
              {order.public_token && order.invoices?.some((doc) => doc.document_type === "invoice") && <a className="button ghost invoice-download-v245" href={`/api/invoices/${order.id}?token=${encodeURIComponent(order.public_token)}`}>{language === "fr" ? "Facture PDF ↓" : "Invoice PDF ↓"}</a>}
              {order.public_token && order.invoices?.some((doc) => doc.document_type === "credit_note") && <a className="button ghost invoice-download-v245" href={`/api/invoices/${order.id}?token=${encodeURIComponent(order.public_token)}&type=credit_note`}>{language === "fr" ? "Avoir PDF ↓" : "Credit note PDF ↓"}</a>}
              {order.tracking_url && order.tracking_number && <a className="button ghost" href={order.tracking_url} target="_blank" rel="noreferrer">{language === "fr" ? "Suivre le colis ↗" : "Track parcel ↗"}</a>}
            </div>
          </article>;
        })}
      </div>}

      {tab === "profile" && <div className="customer-profile-grid-v243">
        <div className="customer-account-panel-v243"><p className="eyebrow">{language === "fr" ? "PROFIL" : "PROFILE"}</p><h2>{language === "fr" ? "Mes informations" : "My details"}</h2><form onSubmit={saveProfile} className="customer-profile-form-v243"><div className="form-grid"><label>{language === "fr" ? "Prénom" : "First name"}<input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} autoComplete="given-name" /></label><label>{language === "fr" ? "Nom" : "Last name"}<input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} autoComplete="family-name" /></label><label>{language === "fr" ? "Téléphone" : "Phone"}<input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} autoComplete="tel" type="tel" /></label><label>Email<input value={user.email || ""} disabled /><small>{language === "fr" ? "L’e-mail du compte est vérifié par Supabase." : "Your account email is verified by Supabase."}</small></label></div><button className="button primary" disabled={saving}>{language === "fr" ? "Enregistrer" : "Save"}</button></form></div>
        <aside className="customer-account-tip-v243"><strong>{language === "fr" ? "Checkout plus rapide" : "Faster checkout"}</strong><p>{language === "fr" ? "Lorsque vous êtes connecté, ces informations et votre adresse par défaut sont préremplies automatiquement lors de votre prochaine commande." : "When signed in, these details and your default address are automatically prefilled on your next order."}</p></aside>
      </div>}

      {tab === "addresses" && <div className="customer-address-layout-v243">
        <div className="customer-address-list-v243"><div className="customer-section-heading-v243"><div><p className="eyebrow">{language === "fr" ? "LIVRAISON" : "DELIVERY"}</p><h2>{language === "fr" ? "Mes adresses" : "My addresses"}</h2></div></div>{addresses.length ? addresses.map((address) => <article className="customer-address-card-v243" key={address.id}><div><div className="customer-address-label-v243"><strong>{address.label}</strong>{address.is_default && <span>{language === "fr" ? "Par défaut" : "Default"}</span>}</div><p>{address.address1}{address.address2 ? <><br />{address.address2}</> : null}<br />{address.postal_code} {address.city}<br />France</p></div><div><button type="button" className="button ghost small" onClick={() => editAddress(address)}>{language === "fr" ? "Modifier" : "Edit"}</button><button type="button" className="customer-delete-link-v243" onClick={() => deleteAddress(address.id)}>{language === "fr" ? "Supprimer" : "Delete"}</button></div></article>) : <div className="customer-empty-v243"><p>{language === "fr" ? "Ajoutez une adresse pour la retrouver automatiquement au checkout." : "Add an address to have it ready automatically at checkout."}</p></div>}</div>
        <form id="customer-address-form-v243" onSubmit={saveAddress} className="customer-account-panel-v243 customer-address-form-v243"><p className="eyebrow">{editingAddressId ? (language === "fr" ? "MODIFIER" : "EDIT") : (language === "fr" ? "NOUVELLE ADRESSE" : "NEW ADDRESS")}</p><h2>{editingAddressId ? (language === "fr" ? "Modifier l’adresse" : "Edit address") : (language === "fr" ? "Ajouter une adresse" : "Add an address")}</h2><label>{language === "fr" ? "Nom de l’adresse" : "Address label"}<input value={addressDraft.label} onChange={(e) => setAddressDraft({ ...addressDraft, label: e.target.value })} placeholder={language === "fr" ? "Maison, Bureau…" : "Home, Work…"} /></label><label>{language === "fr" ? "Adresse *" : "Address *"}<input value={addressDraft.address1} onChange={(e) => setAddressDraft({ ...addressDraft, address1: e.target.value })} autoComplete="street-address" required /></label><label>{language === "fr" ? "Complément" : "Address line 2"}<input value={addressDraft.address2} onChange={(e) => setAddressDraft({ ...addressDraft, address2: e.target.value })} /></label><div className="form-grid"><label>{language === "fr" ? "Code postal *" : "Postal code *"}<input value={addressDraft.postal_code} onChange={(e) => setAddressDraft({ ...addressDraft, postal_code: e.target.value.replace(/\D/g, "").slice(0, 5) })} inputMode="numeric" pattern="[0-9]{5}" required /></label><label>{language === "fr" ? "Ville *" : "City *"}<input value={addressDraft.city} onChange={(e) => setAddressDraft({ ...addressDraft, city: e.target.value })} required /></label></div><label className="customer-default-check-v243"><input type="checkbox" checked={addressDraft.is_default} onChange={(e) => setAddressDraft({ ...addressDraft, is_default: e.target.checked })} /><span>{language === "fr" ? "Utiliser comme adresse par défaut" : "Use as default address"}</span></label><div className="customer-address-form-actions-v243"><button className="button primary" disabled={saving}>{language === "fr" ? "Enregistrer l’adresse" : "Save address"}</button>{editingAddressId && <button type="button" className="button ghost" onClick={() => { setEditingAddressId(null); setAddressDraft(blankAddress); }}>{language === "fr" ? "Annuler" : "Cancel"}</button>}</div></form>
      </div>}
    </div>
  </section>;
}

function orderBucket(order: CustomerOrder): Exclude<OrderFilter, "all"> {
  if (order.status === "refunded" || order.payment_status === "refunded") return "refunded";
  if (order.status === "cancelled") return "cancelled";
  if (["pending", "unpaid", "failed", "expired"].includes(order.payment_status)) return "payment";
  if (order.status === "completed") return "completed";
  return "active";
}

function isActiveOrder(order: CustomerOrder) {
  return orderBucket(order) === "active";
}

function orderVisualState(order: CustomerOrder) {
  if (order.status === "refunded" || order.payment_status === "refunded") return "refunded";
  if (order.status === "cancelled") return "cancelled";
  if (order.payment_status === "failed") return "failed";
  if (order.payment_status === "expired") return "expired";
  if (order.payment_status === "pending" || order.payment_status === "unpaid") return "payment-pending";
  if (order.status === "completed") return "completed";
  if (order.status === "ready") return "ready";
  if (order.status === "preparing") return "preparing";
  return "paid";
}

function customerPaymentActionLabel(order: CustomerOrder, language: "fr" | "en") {
  if (order.payment_status === "expired") {
    return language === "fr" ? "Créer une nouvelle session" : "Create new payment session";
  }
  if (order.payment_status === "failed") {
    return language === "fr" ? "Réessayer le paiement" : "Retry payment";
  }
  return language === "fr" ? "Payer maintenant" : "Pay now";
}

function customerPaymentRecoveryHint(order: CustomerOrder, language: "fr" | "en") {
  if (!canRecoverPaymentStatus(order.payment_status)) return "";
  if (order.payment_status === "failed") {
    return language === "fr"
      ? "Le paiement n’a pas abouti. Reprenez cette commande sans en créer une nouvelle."
      : "The payment did not complete. Retry this order without creating a new one.";
  }
  if (order.payment_status === "expired") {
    return language === "fr"
      ? "La session a expiré. Créez une nouvelle session pour cette même commande."
      : "The session expired. Create a new payment session for this same order.";
  }
  return language === "fr"
    ? "Paiement requis pour que cette commande puisse être traitée."
    : "Payment is required before this order can be processed.";
}

function canRecoverPaymentStatus(paymentStatus: string) {
  return ["pending", "unpaid", "failed", "expired"].includes(paymentStatus);
}

function orderBadgeLabel(order: CustomerOrder, language: "fr" | "en") {
  if (order.status === "refunded" || order.payment_status === "refunded") return language === "fr" ? "Remboursée" : "Refunded";
  if (order.status === "cancelled") return language === "fr" ? "Annulée" : "Cancelled";
  if (order.payment_status === "failed") return language === "fr" ? "Paiement échoué" : "Payment failed";
  if (order.payment_status === "expired") return language === "fr" ? "Session expirée" : "Session expired";
  if (order.payment_status === "pending") return language === "fr" ? "Paiement en attente" : "Payment pending";
  if (order.payment_status === "unpaid") return language === "fr" ? "À payer" : "Unpaid";
  return language === "fr" ? "Payée" : "Paid";
}

function customerStatusLabel(order: CustomerOrder, language: "fr" | "en") {
  if (order.status === "refunded" || order.payment_status === "refunded") return language === "fr" ? "Remboursée" : "Refunded";
  if (order.status === "cancelled") return language === "fr" ? "Annulée" : "Cancelled";
  if (order.payment_status === "failed") return language === "fr" ? "Paiement échoué" : "Payment failed";
  if (order.payment_status === "expired") return language === "fr" ? "Paiement expiré" : "Payment expired";
  if (order.payment_status === "pending" || order.payment_status === "unpaid") return language === "fr" ? "Paiement requis" : "Payment required";
  return statusLabel(order.status, language, order.order_type);
}

function formatOrderItem(item: NonNullable<CustomerOrder["order_items"]>[number], language: "fr" | "en") {
  if (!item.variant) return item.product_name;
  const base = item.product_name.split(" · ")[0]?.trim() || item.product_name;
  const packaging = item.variant.packaging === "can" ? (language === "fr" ? "Boîte" : "Tin") : item.variant.packaging === "bag" ? (language === "fr" ? "Sachet" : "Bag") : "";
  const variantName = String(item.variant.name || "").trim();
  const weight = String(item.variant.weight || "").trim();
  const cleanedVariantName = variantName.replace(/\b(bo[iî]te|sachet|bag|tin|can)\b/gi, "").replace(/^[\s·\-–—]+|[\s·\-–—]+$/g, "").trim();
  const detail = weight || cleanedVariantName;
  const parts = uniqueLabels([base, packaging, detail].filter(Boolean));
  return parts.join(" · ");
}

function choiceSummary(item: NonNullable<CustomerOrder["order_items"]>[number], language: "fr" | "en") {
  const itemLabel = formatOrderItem(item, language).toLowerCase();
  return uniqueLabels((item.choices ?? []).map((choice) => String(choice.label || "").trim()).filter(Boolean))
    .filter((label) => !itemLabel.includes(label.toLowerCase()))
    .join(" · ");
}

function uniqueLabels(labels: string[]) {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = label.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusLabel(status: CustomerOrder["status"], language: "fr" | "en", type: CustomerOrder["order_type"]) {
  const pickupFr: Record<string, string> = { pending: "Reçue", preparing: "En préparation", ready: "Prête à retirer", completed: "Terminée", cancelled: "Annulée", refunded: "Remboursée" };
  const shippingFr: Record<string, string> = { pending: "Reçue", preparing: "Préparation colis", ready: "Prête à expédier", completed: "Expédiée", cancelled: "Annulée", refunded: "Remboursée" };
  const pickupEn: Record<string, string> = { pending: "Received", preparing: "Preparing", ready: "Ready for pickup", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded" };
  const shippingEn: Record<string, string> = { pending: "Received", preparing: "Packing", ready: "Ready to ship", completed: "Shipped", cancelled: "Cancelled", refunded: "Refunded" };
  return type === "shipping" ? (language === "fr" ? shippingFr : shippingEn)[status] : (language === "fr" ? pickupFr : pickupEn)[status];
}